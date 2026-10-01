# RAW Society database (MySQL 8.0+)

| File | Purpose |
|---|---|
| `schema.sql` | Creates the `rawsociety` database: 24 tables, indexes, constraints, 17 triggers, 1 procedure, 1 view |
| `seed.sql`   | The 6 specialties and 6 plans (creator + client) used by the website |
| `postgres/`  | The same design for PostgreSQL, kept in case you ever switch |

## Load it

Use the `mysql` command-line client (phpMyAdmin's import box does not understand the `DELIMITER` lines in the triggers section).

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p rawsociety < database/seed.sql
```

On Windows with the default install the client is at
`C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe`.
With XAMPP use `C:\xampp\mysql\bin\mysql.exe` (XAMPP ships MariaDB; the schema needs MySQL 8, so prefer the MySQL 8 server).

Then add to `.env.local`:

```
DATABASE_URL=mysql://USER:PASSWORD@localhost:3306/rawsociety
```

## Tables (24)

- **Identity**: `users`, `accounts` (Google), `sessions`, `verification_tokens`
- **Profiles**: `categories`, `files`, `creator_profiles`, `creator_links`, `client_profiles`
- **Billing**: `plans`, `subscriptions`, `payments`
- **Catalog**: `services`, `portfolio_works`
- **Social**: `work_likes`, `creator_follows`, `saved_creators`
- **Orders**: `counters`, `orders`, `order_events`, `reviews`
- **Messenger**: `conversations`, `messages` (+ view `conversation_unread`)
- **Other**: `notifications`

## Rules the database enforces by itself

- Emails are unique, case-insensitive, and can be reused after a user is soft-deleted (`deleted_at`).
- One live subscription per user; a payment pays for a plan **or** an order, never both or neither.
- Orders get numbers `ORD-101`, `ORD-102`, ...; client and creator must differ.
- Status changes write `order_events` history, stamp delivered/completed dates and update the creator's `projects_completed`.
- Only the client of a **completed** order can review it, once; rating (1-5) and review count on the creator update automatically.
- Follower and like counters update automatically; nobody can follow or save themselves.
- Only the two people in a conversation can post in it; unread counts come from `conversation_unread`.

## Notes

- IDs are UUIDs stored as `CHAR(36)`; generate them with the database default or in code (`crypto.randomUUID()`).
- Money is `DECIMAL(12,2)` plus a currency code (LYD by default). Timestamps are UTC `DATETIME(3)`.
- Users with billing history (subscriptions/payments) cannot be hard-deleted on purpose; soft-delete them with `deleted_at`.
- Files are stored as metadata; the actual bytes belong in object storage or a disk folder.
- Passwords go in `users.password_hash` (use bcrypt/argon2), never plain text.
