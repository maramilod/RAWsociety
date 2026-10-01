# RAW Society database (PostgreSQL 13+)

| File | Purpose |
|---|---|
| `schema.sql` | All tables, enums, indexes, constraints, triggers, one view |
| `seed.sql`   | The 6 specialties and 6 plans (creator + client) used by the website |

## Load it

```bash
createdb rawsociety
psql rawsociety -f database/schema.sql
psql rawsociety -f database/seed.sql
```

Then add to `.env.local`:

```
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/rawsociety
```

## Tables (23)

- **Identity**: `users`, `accounts` (Google), `sessions`, `verification_tokens`
- **Profiles**: `categories`, `files`, `creator_profiles`, `creator_links`, `client_profiles`
- **Billing**: `plans`, `subscriptions`, `payments`
- **Catalog**: `services`, `portfolio_works`
- **Social**: `work_likes`, `creator_follows`, `saved_creators`
- **Orders**: `orders`, `order_events`, `reviews`
- **Messenger**: `conversations`, `messages` (+ view `conversation_unread`)
- **Other**: `notifications`

## Rules the database enforces by itself

- Emails are unique, case-insensitive; users are soft-deleted (`deleted_at`).
- One live subscription per user; a payment pays for a plan **or** an order, never both or neither.
- Orders get numbers `ORD-101`, `ORD-102`, ...; client and creator must differ.
- Status changes write `order_events` history, stamp delivered/completed dates and update the creator's `projects_completed`.
- Only the client of a **completed** order can review it, once; rating (1-5) and review count on the creator update automatically.
- Follower and like counters update automatically.
- Only the two people in a conversation can post in it; unread counts come from `conversation_unread`.

## Notes

- Money is `NUMERIC(12,2)` plus a currency code (LYD by default).
- Files are stored as metadata; the actual bytes belong in object storage (S3, Cloudflare R2, ...).
- Passwords go in `users.password_hash` (use bcrypt/argon2), never plain text.
