# Authentication

Authorities use bcrypt password verification, optional locally provisioned TOTP and mandatory TOTP in production. JWT access tokens last 15 minutes; rotating refresh sessions last seven days. The refresh token is a random opaque value hashed in storage, carried only in an HttpOnly cookie. Reuse of a revoked refresh token revokes the user's sessions. Every REST request also checks the session and enabled-user flag.

Local citizens may register/sign in by password. Production citizens use Cognito authorization code + PKCE. State/verifier are stored temporarily in sessionStorage; the API validates the resulting ID token and verified email. A Cognito pool/client/domain and exact callback URL must be configured. Cognito manages citizen recovery; full authority recovery/enrollment is not implemented.

Logout revokes the application refresh session; it does not globally sign out every Cognito device. Authority TOTP secrets are encrypted at rest; MFA enrollment, recovery codes, and authority account recovery remain production gates.
