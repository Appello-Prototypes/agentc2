# Google SSO Architecture Diagrams

**Related:** [Full Design](./google-sso-design.md) | [Summary](./google-sso-summary.md)

---

## Current State Architecture

```mermaid
graph TB
    subgraph "Frontend App :3000"
        F_SignIn[Sign-In Form<br/>❌ No Google SSO]
        F_SignUp[Sign-Up Form<br/>❌ No Google SSO]
        F_Email[Email/Password Only]
    end
    
    subgraph "Agent App :3001"
        A_SignIn[Sign-In Form<br/>✅ Has Google SSO]
        A_SignUp[Sign-Up Form<br/>✅ Has Google SSO]
        A_Email[Email/Password]
        A_Sync[Gmail Auto-Sync]
    end
    
    subgraph "Better Auth"
        BA_Config[Better Auth Config<br/>✅ Google OAuth Configured]
        BA_Handler[OAuth Handler<br/>/api/auth/callback/google]
        BA_Session[Session Manager]
    end
    
    subgraph "Database"
        DB_User[(User Table)]
        DB_Account[(Account Table<br/>OAuth Tokens)]
        DB_Session[(Session Table)]
    end
    
    subgraph "Google"
        G_OAuth[Google OAuth Server]
        G_APIs[Gmail/Calendar/Drive APIs]
    end
    
    F_Email --> BA_Handler
    A_Email --> BA_Handler
    A_SignIn --> BA_Config
    A_SignUp --> BA_Config
    
    BA_Config --> G_OAuth
    BA_Handler --> BA_Session
    BA_Session --> DB_User
    BA_Session --> DB_Account
    BA_Session --> DB_Session
    
    A_Sync --> G_APIs
    
    style F_SignIn fill:#ffcccc
    style F_SignUp fill:#ffcccc
    style A_SignIn fill:#ccffcc
    style A_SignUp fill:#ccffcc
```

**Legend:**
- 🔴 Red: Missing Google SSO
- 🟢 Green: Has Google SSO
- ✅ Configured correctly
- ❌ Not implemented

---

## Google OAuth Flow (Agent App - Current)

```mermaid
sequenceDiagram
    participant User
    participant AgentApp as Agent App<br/>(localhost:3001)
    participant BetterAuth as Better Auth<br/>(/api/auth)
    participant Google as Google OAuth
    participant Database as PostgreSQL
    
    User->>AgentApp: Click "Continue with Google"
    AgentApp->>BetterAuth: POST /sign-in/social<br/>{provider: "google", scopes: [...]}
    BetterAuth->>Google: Redirect to consent screen<br/>with client_id, scopes, state
    Google->>User: Show consent screen<br/>(Gmail, Calendar, Drive)
    User->>Google: Approve scopes
    Google->>BetterAuth: Redirect to /callback/google<br/>with code + state
    BetterAuth->>Google: Exchange code for tokens
    Google->>BetterAuth: Return access_token, refresh_token, id_token
    BetterAuth->>Database: Create/Update User record
    BetterAuth->>Database: Create Account record<br/>(providerId: "google", tokens)
    BetterAuth->>Database: Create Session record
    BetterAuth->>AgentApp: Redirect to /workspace<br/>with session cookie
    AgentApp->>User: Show workspace (authenticated)
    
    Note over AgentApp,Database: GmailSyncOnLogin triggers
    AgentApp->>BetterAuth: Check scopes
    alt Missing Scopes
        BetterAuth->>Google: Re-auth with full scopes
        Google->>BetterAuth: Updated tokens
        BetterAuth->>Database: Update Account record
    end
    AgentApp->>Database: Create IntegrationConnection<br/>(Gmail API access)
```

---

## Proposed Architecture (After Phase 1)

```mermaid
graph TB
    subgraph "Frontend App :3000"
        F_SignIn[Sign-In Form<br/>✅ Google SSO Added]
        F_SignUp[Sign-Up Form<br/>✅ Google SSO Added]
        F_Email[Email/Password]
        F_Logo[GoogleLogo Component<br/>NEW]
    end
    
    subgraph "Agent App :3001"
        A_SignIn[Sign-In Form<br/>✅ Has Google SSO]
        A_SignUp[Sign-Up Form<br/>✅ Has Google SSO]
        A_Email[Email/Password]
        A_Sync[Gmail Auto-Sync]
        A_Logo[GoogleLogo Component]
    end
    
    subgraph "Better Auth"
        BA_Config[Better Auth Config<br/>✅ Google OAuth Configured]
        BA_Handler[OAuth Handler<br/>/api/auth/callback/google]
        BA_Session[Session Manager]
        BA_Bootstrap[Organization Bootstrap]
    end
    
    subgraph "Database"
        DB_User[(User Table)]
        DB_Account[(Account Table<br/>OAuth Tokens)]
        DB_Session[(Session Table)]
        DB_Org[(Organization Table)]
        DB_Member[(Membership Table)]
    end
    
    subgraph "Google"
        G_OAuth[Google OAuth Server]
        G_APIs[Gmail/Calendar/Drive APIs]
    end
    
    F_SignIn --> F_Logo
    F_SignUp --> F_Logo
    F_SignIn --> BA_Config
    F_SignUp --> BA_Config
    F_Email --> BA_Handler
    
    A_SignIn --> A_Logo
    A_SignUp --> A_Logo
    A_SignIn --> BA_Config
    A_SignUp --> BA_Config
    A_Email --> BA_Handler
    
    BA_Config --> G_OAuth
    BA_Handler --> BA_Session
    BA_Session --> BA_Bootstrap
    BA_Bootstrap --> DB_Org
    BA_Bootstrap --> DB_Member
    BA_Session --> DB_User
    BA_Session --> DB_Account
    BA_Session --> DB_Session
    
    A_Sync --> G_APIs
    
    style F_SignIn fill:#ccffcc
    style F_SignUp fill:#ccffcc
    style F_Logo fill:#ffffcc
    style A_SignIn fill:#ccffcc
    style A_SignUp fill:#ccffcc
```

**Changes:**
- 🟢 Frontend forms now have Google SSO
- 🟡 New GoogleLogo component created
- ✅ Backend unchanged (already working)

---

## Component Hierarchy

```
Frontend App Authentication
│
├── pages/
│   ├── / (home)
│   │   └── HeroSection
│   │       └── SignInForm  ← Needs Google SSO
│   │
│   └── /signup
│       └── SignUpForm  ← Needs Google SSO
│
└── components/auth/
    ├── GoogleLogo.tsx  ← NEW COMPONENT
    ├── sign-in-form.tsx  ← MODIFY (add Google button)
    └── sign-up-form.tsx  ← MODIFY (add Google button)
```

---

## OAuth Flow Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend App
    participant B as Better Auth
    participant G as Google OAuth
    participant D as Database
    
    Note over U,D: Phase 1 - Sign Up with Google (Frontend App)
    
    U->>F: Navigate to /signup
    F->>U: Show form with "Continue with Google"
    U->>F: Click "Continue with Google"
    F->>B: signIn.social({provider: "google", scopes: [...]})
    B->>G: Redirect to OAuth consent
    G->>U: "AgentC2 wants access to Gmail, Calendar, Drive"
    U->>G: Click "Allow"
    G->>B: Redirect to /callback/google?code=xxx&state=yyy
    B->>G: POST /token (exchange code for tokens)
    G->>B: {access_token, refresh_token, id_token}
    B->>D: INSERT INTO user (email, name, image)
    B->>D: INSERT INTO account (providerId: "google", tokens)
    B->>D: INSERT INTO session (userId, token)
    
    Note over B,D: Organization Bootstrapping
    B->>D: Check if user has membership
    alt No Membership
        B->>U: Redirect to /onboarding
        U->>F: Choose: invite code, create org, or join suggested
        F->>D: Create Organization + Membership
    end
    
    B->>F: Redirect to /dashboard (set session cookie)
    F->>U: Show dashboard (authenticated)
    
    Note over U,F: User navigates to agent app
    U->>F: Click link to /agent/workspace
    F->>U: Redirect to Agent App
    Note over F,B: Session cookie shared via Caddy
    
    U->>F: Agent app loads
    Note over F: GmailSyncOnLogin component runs
    F->>D: Create IntegrationConnection (Gmail)
    F->>G: Sync Gmail data via API
```

---

## Session Cookie Sharing (Caddy)

```mermaid
graph LR
    subgraph "User Browser"
        Cookie[Session Cookie<br/>better-auth.session_token<br/>Domain: .catalyst.localhost]
    end
    
    subgraph "Caddy Reverse Proxy<br/>catalyst.localhost"
        Caddy[Caddy<br/>:443]
    end
    
    subgraph "Backend Services"
        Frontend[Frontend App<br/>:3000<br/>Path: /]
        Agent[Agent App<br/>:3001<br/>Path: /agent]
        Admin[Admin App<br/>:3003<br/>Path: /admin]
    end
    
    Cookie --> Caddy
    Caddy --> Frontend
    Caddy --> Agent
    Caddy --> Admin
    
    Frontend -.Session Shared.-> Agent
    Agent -.Session Shared.-> Admin
```

**Key Points:**
- Single domain ensures cookie sharing
- Cookie set by Better Auth with domain `.catalyst.localhost` (dev) or `.agentc2.ai` (prod)
- All apps read same session cookie
- No cross-origin issues

---

## Database Schema (No Changes Required)

```mermaid
erDiagram
    USER ||--o{ ACCOUNT : "has many"
    USER ||--o{ SESSION : "has many"
    USER ||--o{ MEMBERSHIP : "has many"
    MEMBERSHIP }o--|| ORGANIZATION : "belongs to"
    
    USER {
        string id PK
        string email UK "Unique across all providers"
        string name
        string image "From Google profile"
        boolean emailVerified "Auto-true for OAuth"
        datetime createdAt
    }
    
    ACCOUNT {
        string id PK
        string userId FK
        string providerId "google, microsoft, email"
        string accountId "Google user ID"
        string accessToken "OAuth access token"
        string refreshToken "OAuth refresh token"
        datetime accessTokenExpiresAt
        string scope "Granted scopes"
        string idToken "JWT ID token"
    }
    
    SESSION {
        string id PK
        string userId FK
        string token UK "Session cookie value"
        datetime expiresAt "30-min idle timeout"
        string ipAddress
        string userAgent
    }
    
    ORGANIZATION {
        string id PK
        string name
        string slug UK
    }
    
    MEMBERSHIP {
        string id PK
        string userId FK
        string organizationId FK
        string role "owner, admin, member, viewer"
    }
```

**OAuth Data Flow:**
1. Google OAuth callback creates/updates User
2. Account record stores OAuth tokens with `providerId: "google"`
3. Session record created with unique token (stored in cookie)
4. Bootstrap process creates Organization + Membership

---

## Google Cloud Console Configuration

```mermaid
graph TD
    A[Google Cloud Console] --> B[Create Project<br/>"AgentC2"]
    B --> C[Enable APIs]
    C --> C1[Gmail API]
    C --> C2[Calendar API]
    C --> C3[Drive API]
    
    B --> D[Create OAuth 2.0 Client]
    D --> D1[Application Type:<br/>Web Application]
    D1 --> D2[Authorized Redirect URIs]
    D2 --> D2a[Dev: localhost:3001/api/auth/callback/google]
    D2 --> D2b[Prod: agentc2.ai/api/auth/callback/google]
    D1 --> D3[Copy Client ID + Secret<br/>to .env]
    
    B --> E[Configure OAuth Consent Screen]
    E --> E1[App Name: AgentC2]
    E --> E2[Add Scopes]
    E2 --> E2a[gmail.modify]
    E2 --> E2b[calendar.events]
    E2 --> E2c[drive.readonly]
    E2 --> E2d[drive.file]
    
    E --> F{Publishing Status}
    F -->|Testing| F1[Max 100 Test Users<br/>No Verification Needed]
    F -->|In Production| F2[Unlimited Users<br/>Verification Required]
    
    F2 --> G[Submit for Verification]
    G --> G1[Privacy Policy URL]
    G --> G2[Terms of Service URL]
    G --> G3[Demo Video]
    G --> G4[Scope Justification]
    G --> H[Wait 4-6 Weeks]
    
    style F1 fill:#ccffcc
    style F2 fill:#ffffcc
    style H fill:#ffcccc
```

---

## Sign-In Flow Comparison

### Before (Frontend App)

```
┌─────────────────────────────────┐
│         Sign In                 │
├─────────────────────────────────┤
│                                 │
│  Email: [_________________]     │
│                                 │
│  Password: [_____________]      │
│                                 │
│  [Sign In]                      │
│                                 │
│  Don't have an account? Sign up │
└─────────────────────────────────┘
```

### After (Frontend App - Matches Agent App)

```
┌─────────────────────────────────┐
│         Sign In                 │
├─────────────────────────────────┤
│                                 │
│  [G] Continue with Google       │  ← NEW
│                                 │
│  ─── or continue with email ─── │  ← NEW
│                                 │
│  Email: [_________________]     │
│                                 │
│  Password: [_____________]      │
│                                 │
│  [Sign In]                      │
│                                 │
│  Don't have an account? Sign up │
└─────────────────────────────────┘
```

---

## Error Handling Flow

```mermaid
stateDiagram-v2
    [*] --> Idle: User on sign-in page
    Idle --> OAuthInitiated: Click "Continue with Google"
    
    OAuthInitiated --> GoogleConsent: Redirect to Google
    
    GoogleConsent --> Success: User approves
    GoogleConsent --> Cancelled: User cancels
    GoogleConsent --> Error: Network error
    
    Success --> TokenExchange: Better Auth exchanges code
    TokenExchange --> SessionCreated: Tokens received
    SessionCreated --> Bootstrap: Check membership
    
    Bootstrap --> HasOrg: Membership exists
    Bootstrap --> CreateOrg: No membership
    
    HasOrg --> [*]: Redirect to /workspace
    CreateOrg --> [*]: Redirect to /onboarding
    
    Cancelled --> ShowError: "Authentication cancelled"
    Error --> ShowError: "Please try again"
    ShowError --> Idle: User can retry
    
    state ShowError {
        [*] --> DisplayMessage
        DisplayMessage --> [*]
    }
```

---

## Multi-Tenant Organization Bootstrap

```mermaid
flowchart TD
    Start[New User Signs In with Google] --> CheckMembership{Has Membership?}
    
    CheckMembership -->|Yes| RedirectWorkspace[Redirect to /workspace]
    CheckMembership -->|No| Bootstrap[bootstrapUserOrganization]
    
    Bootstrap --> CheckInvite{Has Invite Code?}
    
    CheckInvite -->|Yes - Platform| GrantAccess[Grant Platform Access]
    GrantAccess --> CreateOrg[Create New Org<br/>User is Owner]
    CreateOrg --> RedirectOnboard[Redirect to /onboarding]
    
    CheckInvite -->|Yes - Org-Scoped| JoinOrg[Join Existing Org<br/>User is Member]
    JoinOrg --> RunHooks[Run Post-Bootstrap Hooks<br/>Gmail Sync, etc.]
    RunHooks --> RedirectOnboard
    
    CheckInvite -->|No| CheckDomain{Email Domain Match?}
    
    CheckDomain -->|Exact Match| SuggestOrg[Suggest Organization<br/>Coworkers with @domain]
    CheckDomain -->|No Match| CreateOrg
    
    SuggestOrg --> UserChoice{User Chooses}
    UserChoice -->|Join Suggested| JoinOrg
    UserChoice -->|Create New| CreateOrg
    
    RedirectOnboard --> End[User Completes Onboarding]
    RedirectWorkspace --> End
```

**Important Notes:**
- `deferOrgCreation: true` means user is prompted to choose org creation strategy
- Post-bootstrap hooks only run when org is actually created/joined (not deferred)
- Frontend app needs to handle onboarding flow for org selection

---

## Account Linking Flow (Phase 3)

```mermaid
sequenceDiagram
    participant User
    participant Frontend as Frontend App
    participant BetterAuth as Better Auth
    participant Google as Google OAuth
    participant Database as Database
    
    Note over User,Database: User has email/password account
    
    User->>Frontend: Navigate to /settings/account
    Frontend->>Database: Query user accounts
    Database->>Frontend: [Account(email/password)]
    Frontend->>User: Show "Connect Google" button
    
    User->>Frontend: Click "Connect Google"
    Frontend->>BetterAuth: linkSocial({provider: "google", scopes: [...]})
    BetterAuth->>Google: Redirect to OAuth consent
    Google->>User: Show consent screen
    User->>Google: Approve
    Google->>BetterAuth: Callback with code
    BetterAuth->>Google: Exchange code for tokens
    Google->>BetterAuth: Return tokens
    
    BetterAuth->>Database: Check if email matches existing user
    Database->>BetterAuth: User found with same email
    BetterAuth->>Database: INSERT INTO account<br/>(userId, providerId: "google", tokens)
    BetterAuth->>Frontend: Redirect to /settings/account
    
    Frontend->>Database: Query user accounts
    Database->>Frontend: [Account(email), Account(google)]
    Frontend->>User: Show both connected accounts
```

---

## Rate Limiting Architecture

```mermaid
graph LR
    subgraph "User Requests"
        R1[Request 1]
        R2[Request 2]
        R3[Request 3]
        RN[Request N]
    end
    
    subgraph "Better Auth Handler"
        RateLimit[Rate Limiter<br/>100 req/min/IP]
        AuthHandler[OAuth Handler]
    end
    
    subgraph "Google OAuth"
        GoogleAPI[Google OAuth API]
    end
    
    R1 --> RateLimit
    R2 --> RateLimit
    R3 --> RateLimit
    RN --> RateLimit
    
    RateLimit -->|Allowed| AuthHandler
    RateLimit -->|Blocked| Reject[429 Too Many Requests]
    
    AuthHandler --> GoogleAPI
    
    style Reject fill:#ffcccc
```

**Current State:**
- ✅ Agent app has rate limiting
- ❌ Frontend app does NOT have rate limiting

**Recommendation:** Add rate limiting to frontend app in Phase 2.

---

## Security Layers

```mermaid
graph TB
    subgraph "Application Layer"
        A1[Rate Limiting<br/>100 req/min]
        A2[Input Validation]
        A3[Error Handling]
    end
    
    subgraph "OAuth Layer"
        O1[PKCE<br/>Code Challenge]
        O2[State Parameter<br/>CSRF Protection]
        O3[Scope Validation]
    end
    
    subgraph "Transport Layer"
        T1[HTTPS Only<br/>via Caddy]
        T2[HTTP-Only Cookies]
        T3[Secure Cookie Flag]
    end
    
    subgraph "Storage Layer"
        S1[PostgreSQL<br/>SSL Connection]
        S2[Token Encryption<br/>Better Auth Secret]
        S3[Session Expiry<br/>30-min Idle]
    end
    
    User[User Request] --> A1
    A1 --> A2
    A2 --> A3
    A3 --> O1
    O1 --> O2
    O2 --> O3
    O3 --> T1
    T1 --> T2
    T2 --> T3
    T3 --> S1
    S1 --> S2
    S2 --> S3
    S3 --> Secure[Secure OAuth Flow]
    
    style Secure fill:#ccffcc
```

**All Layers:**
- ✅ Better Auth implements all OAuth security best practices
- ✅ PKCE prevents authorization code interception
- ✅ State parameter prevents CSRF attacks
- ✅ HTTPS prevents man-in-the-middle attacks
- ✅ HttpOnly cookies prevent XSS token theft
- ✅ Session expiry limits unauthorized access window

---

## Deployment Architecture

```mermaid
graph TB
    subgraph "Production Environment"
        direction TB
        
        subgraph "Caddy Reverse Proxy<br/>agentc2.ai"
            Caddy[Caddy<br/>:443 HTTPS]
        end
        
        subgraph "Next.js Apps"
            Frontend[Frontend<br/>:3000<br/>Path: /]
            Agent[Agent<br/>:3001<br/>Path: /agent]
        end
        
        subgraph "Database"
            Postgres[(PostgreSQL<br/>Supabase)]
        end
        
        subgraph "External Services"
            Google[Google OAuth<br/>accounts.google.com]
        end
    end
    
    User[User] -->|HTTPS| Caddy
    Caddy -->|Proxy /| Frontend
    Caddy -->|Proxy /agent| Agent
    
    Frontend --> Postgres
    Agent --> Postgres
    
    Frontend -.OAuth Flow.-> Google
    Agent -.OAuth Flow.-> Google
    
    Google -.Callback.-> Caddy
    Caddy -.Route Callback.-> Agent
```

**OAuth Callback Routing:**
- Callback URL: `https://agentc2.ai/api/auth/callback/google`
- Caddy proxies to agent app: `http://localhost:3001/api/auth/callback/google`
- Better Auth handles callback in agent app
- Session cookie set with domain `.agentc2.ai`
- Frontend app automatically has access to session

---

## Comparison: Email vs OAuth User Journey

### Email/Password Sign-Up

```
1. User lands on /signup
2. Fill in: Name, Email, Password
3. Submit form
4. Email verification sent (production)
5. Click verification link
6. Redirected to /onboarding
7. Choose organization (invite or create)
8. Complete onboarding
9. Access workspace

Total Steps: 9
Time: ~5-10 minutes
Drop-off: High (email verification, password creation)
```

### Google OAuth Sign-Up

```
1. User lands on /signup
2. Click "Continue with Google"
3. Approve scopes on Google consent screen
4. Redirected to /onboarding
5. Choose organization (invite or create)
6. Complete onboarding
7. Access workspace

Total Steps: 7
Time: ~2-3 minutes
Drop-off: Low (no email verification, no password)
```

**Improvement:**
- ✅ 22% fewer steps
- ✅ 50-60% faster
- ✅ Higher conversion rate (no email verification needed)
- ✅ Better security (Google MFA, device trust)

---

## Rollback Strategy

```mermaid
graph LR
    Deploy[Deploy Phase 1] --> Monitor{Issues Detected?}
    
    Monitor -->|No Issues| Success[✅ Complete]
    Monitor -->|Issues Found| Assess{Severity?}
    
    Assess -->|Critical| Rollback[Immediate Rollback]
    Assess -->|Minor| Fix[Hotfix + Redeploy]
    Assess -->|UI Only| Disable[Hide Google Button]
    
    Rollback --> GitRevert[git revert HEAD]
    GitRevert --> Rebuild[bun run build]
    Rebuild --> Restart[pm2 restart frontend]
    Restart --> Validate[Validate email/password works]
    
    Fix --> GitCommit[git commit fix]
    GitCommit --> Rebuild
    
    Disable --> FeatureFlag[Add isGoogleConfigured check]
    FeatureFlag --> HideButton[Conditionally render button]
    HideButton --> Rebuild
    
    style Success fill:#ccffcc
    style Rollback fill:#ffcccc
    style Validate fill:#ffffcc
```

**Rollback Time:** < 5 minutes (frontend-only changes, no database migrations)

---

## Monitoring Dashboard (Proposed)

```
┌─────────────────────────────────────────────────────────────┐
│  Google OAuth Dashboard                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Success Rate (Last 24h)                                    │
│  ███████████████████████████████████ 97.3%                  │
│                                                             │
│  Sign-Ups by Method                                         │
│  ┌─────────┬─────────┬─────────┐                            │
│  │ Google  │ Email   │ Other   │                            │
│  │  45%    │  50%    │   5%    │                            │
│  └─────────┴─────────┴─────────┘                            │
│                                                             │
│  Recent Errors                                              │
│  ┌────────────┬─────────────────────────┬────────┐          │
│  │ Timestamp  │ Error                   │ Count  │          │
│  ├────────────┼─────────────────────────┼────────┤          │
│  │ 10:30 AM   │ user_cancelled          │   3    │          │
│  │ 10:15 AM   │ redirect_uri_mismatch   │   1    │          │
│  │ 09:45 AM   │ invalid_scope           │   1    │          │
│  └────────────┴─────────────────────────┴────────┘          │
│                                                             │
│  Token Refresh Status                                       │
│  Last 1000 refreshes: 998 success, 2 failed (99.8%)        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1 vs Phase 3 Comparison

### Phase 1: Basic Google SSO

**What User Sees:**
```
Sign In Page:
- "Continue with Google" button
- Or email/password form

After Google Sign-In:
- Redirected to workspace
- Authenticated on both apps
```

**Limitations:**
- Can't link Google to existing email/password account via UI
- Can't see which accounts are connected
- Can't unlink Google account

---

### Phase 3: Account Management

**What User Sees:**
```
Settings > Account:
┌────────────────────────────────────┐
│  Connected Accounts                │
├────────────────────────────────────┤
│  ✅ Email/Password                 │
│     you@example.com                │
│     [Change Password]              │
│                                    │
│  ✅ Google                         │
│     you@example.com                │
│     [Disconnect]                   │
│                                    │
│  ❌ Microsoft                      │
│     [Connect Microsoft]            │
└────────────────────────────────────┘
```

**Benefits:**
- User can link OAuth providers post-signup
- Clear visibility of connected accounts
- Can disconnect providers (with safeguards)
- Can re-auth if scopes missing

---

## Code Diff Preview

### sign-in-form.tsx (Frontend App)

**Before:**
```typescript
export function SignInForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    
    return (
        <form onSubmit={handleSubmit}>
            <Input type="email" value={email} />
            <Input type="password" value={password} />
            <Button type="submit">Sign In</Button>
        </form>
    );
}
```

**After:**
```typescript
import { GOOGLE_OAUTH_SCOPES } from "@repo/auth/google-scopes";
import { GoogleLogo } from "./GoogleLogo";

export function SignInForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [socialLoading, setSocialLoading] = useState(false);  // NEW
    
    const handleSocialSignIn = async (provider: "google") => {  // NEW
        setSocialLoading(true);
        await signIn.social({
            provider,
            callbackURL: callbackUrl,
            scopes: [...GOOGLE_OAUTH_SCOPES]
        });
    };
    
    return (
        <div>
            {/* NEW: Google SSO Button */}
            <Button onClick={() => handleSocialSignIn("google")}>
                <GoogleLogo />
                Continue with Google
            </Button>
            
            {/* NEW: Divider */}
            <div>or continue with email</div>
            
            {/* EXISTING: Email Form */}
            <form onSubmit={handleSubmit}>
                <Input type="email" value={email} />
                <Input type="password" value={password} />
                <Button type="submit" disabled={socialLoading}>Sign In</Button>
            </form>
        </div>
    );
}
```

**Changes:**
- ➕ Import `GOOGLE_OAUTH_SCOPES` and `GoogleLogo`
- ➕ Add `socialLoading` state
- ➕ Add `handleSocialSignIn` function
- ➕ Add Google SSO button with logo
- ➕ Add divider
- 🔄 Update disabled states

**Lines Changed:** ~50 lines added

---

## Related Documentation

**Main Design:** [google-sso-design.md](./google-sso-design.md) - Complete technical design (100+ pages)

**Quick Summary:** [google-sso-summary.md](./google-sso-summary.md) - Executive summary

**Code References:**
- [Better Auth Config](../../../packages/auth/src/auth.ts)
- [Google Scopes](../../../packages/auth/src/google-scopes.ts)
- [Agent App Sign-In](../../../apps/agent/src/components/auth/sign-in-form.tsx) - Reference implementation
- [Agent App Sign-Up](../../../apps/agent/src/components/auth/sign-up-form.tsx) - Reference implementation

**External Docs:**
- [Better Auth Documentation](https://www.better-auth.com/)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google OAuth Verification Process](https://support.google.com/cloud/answer/9110914)

---

**Last Updated:** 2026-03-08  
**Version:** 1.0  
**Status:** Ready for Implementation