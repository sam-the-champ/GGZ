# Data retention & deletion policy (draft — for organiser approval)

| Data | Where | Retention | How it's removed |
| --- | --- | --- | --- |
| Participant details (name, phone, DOB, city, emergency contact, guardian, support needs) | `Participant` | Until **6 months after the camp ends** (i.e. ~June 2027) | Admin → registration → **Erase personal data** (anonymises in place, audited), or a scheduled SQL clean-up after the retention date |
| Unpaid / failed / abandoned checkout attempts (email + reference) | `RegistrationAttempt` | **90 days** | `DELETE FROM "RegistrationAttempt" WHERE "paymentStatus" IN ('INITIATED','PENDING','FAILED','ABANDONED') AND "createdAt" < now() - interval '90 days';` |
| Verified payment records (reference, amounts, status, channel, timestamps) | `Payment` | As long as required for financial records | Customer email is cleared when a participant is erased |
| Continuation / recovery tokens | `ContinuationToken` | Until expiry (≤ 24 h) | Daily `/api/cron/reconcile` |
| Rate-limit counters (HMAC-ed identifiers, no raw IPs) | `RateLimitBucket` | Until window end | Daily cron |
| Admin sessions | `AdminSession` | ≤ 8 hours | Login + daily cron |
| Help Center requests and replies (name, email, phone, messages) | `SupportTicket`, `SupportMessage` | Until **6 months after the camp ends** | Manual delete in the database; requests mentioning an erased participant should be deleted at the same time |
| Audit log (no passwords, secrets or full personal data) | `AuditLog` | 2 years | Manual |

Access/deletion requests: handled by the organisers via the admin dashboard; confirm the requester's identity first. Erasing before camp means the place cannot be kept.
