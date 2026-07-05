# Security review checklist (design-sync step 35)

Manual pass before production deploy. Not automated.

## Auth & session

- [ ] JWT expiry and refresh rotation behave correctly on 401
- [ ] Password reset tokens are single-use and time-limited
- [ ] Demo/offline mode cannot access paid API routes when `API_BASE` is set

## Shares & viewer

- [ ] Share links resolve via `POST /api/shares`, not raw project IDs in URL
- [ ] Viewer role: map editor `readOnly` hides edit controls and blocks socket mutations
- [ ] Shared map route (`sharedMap`) is read-only without auth

## API

- [ ] Stripe webhook excluded from rate limiter
- [ ] CORS allows only configured origins in production
- [ ] Project join requires valid invite / membership rules

## Client

- [ ] Notification deep links use in-app routing (`followNotificationLink`), not full reload when possible
- [ ] User HTML in nodes/comments sanitized (`sanitize`)
- [ ] No secrets in `public/env-config.js` committed for prod

*Last updated: prog4 design-sync.*
