-- Data migration: GGZ Camp 1.0 moved to 10–12 December 2026 (was 8–10).
-- Only the event's dates change; no other data is touched.
UPDATE "Event"
SET "startDate" = DATE '2026-12-10',
    "endDate"   = DATE '2026-12-12',
    "updatedAt" = NOW()
WHERE "slug" = 'ggz-camp-1';
