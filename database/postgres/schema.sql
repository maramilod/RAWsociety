-- =====================================================================
-- RAW Society - PostgreSQL schema (PostgreSQL 13+)
-- Marketplace connecting creators with clients.
--
-- Sections
--   1. Enums
--   2. Identity & auth          (users, accounts, sessions, verification_tokens)
--   3. Profiles                 (categories, files, creator_profiles, creator_links, client_profiles)
--   4. Plans & billing          (plans, subscriptions, payments)
--   5. Catalog                  (services, portfolio_works)
--   6. Social                   (work_likes, creator_follows, saved_creators)
--   7. Orders & reviews         (orders, order_events, reviews)
--   8. Messenger                (conversations, messages)
--   9. Notifications
--  10. Triggers (updated_at, denormalised counters, order history)
--
-- Conventions: uuid primary keys, timestamptz everywhere, money as
-- NUMERIC(12,2) + ISO currency code, soft delete on users (deleted_at).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------
CREATE TYPE user_role           AS ENUM ('creator', 'client', 'admin');
CREATE TYPE user_status         AS ENUM ('active', 'suspended', 'pending_verification');
CREATE TYPE file_kind           AS ENUM ('avatar', 'cover', 'cv', 'logo', 'work_media', 'message_attachment');
CREATE TYPE creator_badge       AS ENUM ('none', 'pro', 'featured', 'top_rated');
CREATE TYPE billing_interval    AS ENUM ('month', 'year');
CREATE TYPE subscription_status AS ENUM ('pending', 'active', 'past_due', 'cancelled', 'expired');
CREATE TYPE payment_method      AS ENUM ('sadad', 'mobicash', 'local_bank_card', 'bank_transfer');
CREATE TYPE payment_status      AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE order_status        AS ENUM ('pending', 'in_progress', 'in_review', 'completed', 'cancelled', 'disputed');
CREATE TYPE notification_type   AS ENUM ('new_message', 'order_update', 'payment', 'review', 'follow', 'system');

-- ---------------------------------------------------------------------
-- 2. IDENTITY & AUTH  (column names follow the NextAuth/Auth.js adapter)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email           varchar(255) NOT NULL,
    email_verified  timestamptz,
    password_hash   text,                         -- NULL for Google-only accounts
    name            varchar(120) NOT NULL,
    image           text,                         -- avatar URL (Google or uploaded)
    role            user_role   NOT NULL,
    status          user_status NOT NULL DEFAULT 'active',
    last_login_at   timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,
    CONSTRAINT users_email_format CHECK (position('@' in email) > 1)
);
-- case-insensitive uniqueness, ignoring soft-deleted rows
CREATE UNIQUE INDEX users_email_uq ON users (lower(email)) WHERE deleted_at IS NULL;
CREATE INDEX users_role_idx ON users (role) WHERE deleted_at IS NULL;

-- OAuth links (Google sign-in)
CREATE TABLE accounts (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                varchar(40)  NOT NULL,
    provider            varchar(40)  NOT NULL,
    provider_account_id varchar(255) NOT NULL,
    refresh_token       text,
    access_token        text,
    expires_at          bigint,
    token_type          varchar(40),
    scope               text,
    id_token            text,
    session_state       text,
    UNIQUE (provider, provider_account_id)
);
CREATE INDEX accounts_user_idx ON accounts (user_id);

-- Only needed if you use database sessions instead of JWT sessions
CREATE TABLE sessions (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token text NOT NULL UNIQUE,
    user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires       timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- Email verification / password reset tokens (store a hash, not the raw token)
CREATE TABLE verification_tokens (
    identifier text        NOT NULL,
    token      text        NOT NULL UNIQUE,
    expires    timestamptz NOT NULL,
    PRIMARY KEY (identifier, token)
);

-- ---------------------------------------------------------------------
-- 3. PROFILES
-- ---------------------------------------------------------------------
CREATE TABLE categories (
    id         smallserial PRIMARY KEY,
    slug       varchar(60)  NOT NULL UNIQUE,
    name       varchar(100) NOT NULL UNIQUE,
    sort_order smallint     NOT NULL DEFAULT 0,
    is_active  boolean      NOT NULL DEFAULT true
);

-- Uploaded files: metadata only, the bytes live in object storage (S3/R2/...)
CREATE TABLE files (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind          file_kind    NOT NULL,
    storage_key   text         NOT NULL UNIQUE,
    url           text         NOT NULL,
    original_name varchar(255),
    mime_type     varchar(120) NOT NULL,
    size_bytes    bigint       NOT NULL CHECK (size_bytes > 0),
    created_at    timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX files_owner_idx ON files (owner_id, kind);

CREATE TABLE creator_profiles (
    user_id            uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    category_id        smallint NOT NULL REFERENCES categories(id),
    headline           varchar(120),                 -- e.g. "Product & Brand Designer"
    bio                text,
    about              text,
    location           varchar(120),
    hourly_rate        numeric(10,2) CHECK (hourly_rate >= 0),
    currency           char(3) NOT NULL DEFAULT 'LYD',
    cover_file_id      uuid REFERENCES files(id) ON DELETE SET NULL,
    cv_file_id         uuid REFERENCES files(id) ON DELETE SET NULL,
    badge              creator_badge NOT NULL DEFAULT 'none',
    is_public          boolean NOT NULL DEFAULT true,
    -- denormalised counters, maintained by triggers (section 10)
    rating_avg         numeric(3,2) NOT NULL DEFAULT 0 CHECK (rating_avg BETWEEN 0 AND 5),
    reviews_count      integer NOT NULL DEFAULT 0,
    followers_count    integer NOT NULL DEFAULT 0,
    projects_completed integer NOT NULL DEFAULT 0,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX creator_profiles_category_idx ON creator_profiles (category_id) WHERE is_public;
CREATE INDEX creator_profiles_rating_idx   ON creator_profiles (rating_avg DESC) WHERE is_public;

-- Behance / Dribbble / GitHub / Drive links from the onboarding form
CREATE TABLE creator_links (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id uuid NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
    label      varchar(60),
    url        text NOT NULL CHECK (url ~* '^https?://'),
    sort_order smallint NOT NULL DEFAULT 0,
    UNIQUE (creator_id, url)
);

CREATE TABLE client_profiles (
    user_id       uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    company_name  varchar(160),
    industry      varchar(100),
    company_size  varchar(40),
    budget_range  varchar(60),
    logo_file_id  uuid REFERENCES files(id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 4. PLANS & BILLING
-- ---------------------------------------------------------------------
CREATE TABLE plans (
    id         smallserial PRIMARY KEY,
    code       varchar(40)  NOT NULL UNIQUE,         -- 'creator_pro', 'client_enterprise', ...
    audience   user_role    NOT NULL CHECK (audience IN ('creator', 'client')),
    name       varchar(80)  NOT NULL,
    price      numeric(10,2) NOT NULL CHECK (price >= 0),
    currency   char(3)      NOT NULL DEFAULT 'LYD',
    interval   billing_interval NOT NULL DEFAULT 'month',
    limits     jsonb        NOT NULL DEFAULT '{}'::jsonb,   -- e.g. {"max_works":15,"max_briefs":3}
    features   jsonb        NOT NULL DEFAULT '[]'::jsonb,   -- bullet list shown on the plan page
    is_active  boolean      NOT NULL DEFAULT true,
    sort_order smallint     NOT NULL DEFAULT 0
);

CREATE TABLE subscriptions (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id              smallint NOT NULL REFERENCES plans(id),
    status               subscription_status NOT NULL DEFAULT 'pending',
    current_period_start timestamptz,
    current_period_end   timestamptz,
    cancel_at_period_end boolean NOT NULL DEFAULT false,
    cancelled_at         timestamptz,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    CHECK (current_period_end IS NULL OR current_period_end > current_period_start)
);
-- a user can have at most one live subscription
CREATE UNIQUE INDEX subscriptions_one_live_uq ON subscriptions (user_id)
    WHERE status IN ('pending', 'active', 'past_due');
CREATE INDEX subscriptions_renewal_idx ON subscriptions (current_period_end) WHERE status = 'active';

CREATE TABLE payments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id),
    subscription_id uuid REFERENCES subscriptions(id),
    order_id        uuid,                              -- FK added after orders exists
    amount          numeric(12,2) NOT NULL CHECK (amount >= 0),
    currency        char(3) NOT NULL DEFAULT 'LYD',
    method          payment_method NOT NULL,
    status          payment_status NOT NULL DEFAULT 'pending',
    provider_ref    varchar(120),                      -- Sadad / Mobicash / bank reference
    failure_reason  text,
    paid_at         timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CHECK (num_nonnulls(subscription_id, order_id) = 1),   -- pays for a plan OR an order
    CHECK (status <> 'paid' OR paid_at IS NOT NULL)
);
CREATE UNIQUE INDEX payments_provider_ref_uq ON payments (method, provider_ref) WHERE provider_ref IS NOT NULL;
CREATE INDEX payments_user_idx ON payments (user_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 5. CATALOG
-- ---------------------------------------------------------------------
-- Services a creator sells ("+ New Service" on the creator dashboard)
CREATE TABLE services (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id    uuid NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
    category_id   smallint NOT NULL REFERENCES categories(id),
    title         varchar(160) NOT NULL,
    description   text,
    price         numeric(12,2) NOT NULL CHECK (price >= 0),
    currency      char(3) NOT NULL DEFAULT 'LYD',
    delivery_days smallint CHECK (delivery_days > 0),
    is_active     boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX services_creator_idx  ON services (creator_id) WHERE is_active;
CREATE INDEX services_category_idx ON services (category_id) WHERE is_active;

-- Portfolio pieces shown on creator profiles / Featured Work
CREATE TABLE portfolio_works (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id    uuid NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
    category_id   smallint REFERENCES categories(id),
    title         varchar(160) NOT NULL,
    description   text,
    cover_file_id uuid REFERENCES files(id) ON DELETE SET NULL,
    price         numeric(10,2) CHECK (price >= 0),        -- NULL = not for sale
    currency      char(3) NOT NULL DEFAULT 'USD',
    is_featured   boolean NOT NULL DEFAULT false,
    likes_count   integer NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX portfolio_works_creator_idx  ON portfolio_works (creator_id, created_at DESC);
CREATE INDEX portfolio_works_featured_idx ON portfolio_works (likes_count DESC) WHERE is_featured;

-- ---------------------------------------------------------------------
-- 6. SOCIAL
-- ---------------------------------------------------------------------
CREATE TABLE work_likes (
    work_id    uuid NOT NULL REFERENCES portfolio_works(id) ON DELETE CASCADE,
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (work_id, user_id)
);

CREATE TABLE creator_follows (
    follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_id  uuid NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, creator_id),
    CHECK (follower_id <> creator_id)
);
CREATE INDEX creator_follows_creator_idx ON creator_follows (creator_id);

-- Client bookmarks ("Saved Creators" on the client dashboard)
CREATE TABLE saved_creators (
    client_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_id uuid NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (client_id, creator_id),
    CHECK (client_id <> creator_id)
);

-- ---------------------------------------------------------------------
-- 7. ORDERS & REVIEWS
-- ---------------------------------------------------------------------
CREATE SEQUENCE order_number_seq START 101;

CREATE TABLE orders (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number  varchar(20) NOT NULL UNIQUE
                  DEFAULT ('ORD-' || nextval('order_number_seq')),   -- ORD-101 ...
    client_id     uuid NOT NULL REFERENCES users(id),
    creator_id    uuid NOT NULL REFERENCES creator_profiles(user_id),
    service_id    uuid REFERENCES services(id) ON DELETE SET NULL,
    title         varchar(160) NOT NULL,                              -- snapshot of the service name
    brief         text,
    amount        numeric(12,2) NOT NULL CHECK (amount >= 0),
    currency      char(3) NOT NULL DEFAULT 'LYD',
    status        order_status NOT NULL DEFAULT 'pending',
    due_date      date,
    delivered_at  timestamptz,
    completed_at  timestamptz,
    cancelled_at  timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CHECK (client_id <> creator_id),
    CHECK (status <> 'completed' OR completed_at IS NOT NULL)
);
CREATE INDEX orders_client_idx  ON orders (client_id,  status, created_at DESC);
CREATE INDEX orders_creator_idx ON orders (creator_id, status, created_at DESC);

ALTER TABLE payments
    ADD CONSTRAINT payments_order_fk FOREIGN KEY (order_id) REFERENCES orders(id);

-- Status history / audit trail
CREATE TABLE order_events (
    id          bigserial PRIMARY KEY,
    order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
    from_status order_status,
    to_status   order_status NOT NULL,
    note        text,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_events_order_idx ON order_events (order_id, created_at);

-- One review per completed order, written by the client
CREATE TABLE reviews (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    client_id   uuid NOT NULL REFERENCES users(id),
    creator_id  uuid NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
    rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     text,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_creator_idx ON reviews (creator_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 8. MESSENGER  (one conversation per client/creator pair)
-- ---------------------------------------------------------------------
CREATE TABLE conversations (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_id            uuid NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
    client_last_read_at   timestamptz,
    creator_last_read_at  timestamptz,
    last_message_at       timestamptz,
    created_at            timestamptz NOT NULL DEFAULT now(),
    UNIQUE (client_id, creator_id),
    CHECK (client_id <> creator_id)
);
CREATE INDEX conversations_client_idx  ON conversations (client_id,  last_message_at DESC);
CREATE INDEX conversations_creator_idx ON conversations (creator_id, last_message_at DESC);

CREATE TABLE messages (
    id              bigserial PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       uuid NOT NULL REFERENCES users(id),
    order_id        uuid REFERENCES orders(id) ON DELETE SET NULL,   -- optional: message about an order
    body            text NOT NULL CHECK (length(btrim(body)) > 0),
    attachment_id   uuid REFERENCES files(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    edited_at       timestamptz,
    deleted_at      timestamptz
);
CREATE INDEX messages_conversation_idx ON messages (conversation_id, id DESC);

-- ---------------------------------------------------------------------
-- 9. NOTIFICATIONS
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       notification_type NOT NULL,
    title      varchar(160) NOT NULL,
    data       jsonb NOT NULL DEFAULT '{}'::jsonb,
    read_at    timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_unread_idx ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;

-- ---------------------------------------------------------------------
-- 10. TRIGGERS
-- ---------------------------------------------------------------------

-- 10.1 keep updated_at fresh
CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$;

CREATE TRIGGER users_updated_at            BEFORE UPDATE ON users            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER creator_profiles_updated_at BEFORE UPDATE ON creator_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER client_profiles_updated_at  BEFORE UPDATE ON client_profiles  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER subscriptions_updated_at    BEFORE UPDATE ON subscriptions    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER services_updated_at         BEFORE UPDATE ON services         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER portfolio_works_updated_at  BEFORE UPDATE ON portfolio_works  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER orders_updated_at           BEFORE UPDATE ON orders           FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 10.2 creator rating / review counter
CREATE FUNCTION refresh_creator_rating() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    target uuid := COALESCE(NEW.creator_id, OLD.creator_id);
BEGIN
    UPDATE creator_profiles cp
       SET rating_avg    = COALESCE((SELECT round(avg(rating)::numeric, 2) FROM reviews WHERE creator_id = target), 0),
           reviews_count = (SELECT count(*) FROM reviews WHERE creator_id = target)
     WHERE cp.user_id = target;
    RETURN NULL;
END $$;

CREATE TRIGGER reviews_refresh_rating
    AFTER INSERT OR UPDATE OF rating OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION refresh_creator_rating();

-- 10.3 follower counter
CREATE FUNCTION refresh_followers_count() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    target uuid := COALESCE(NEW.creator_id, OLD.creator_id);
BEGIN
    UPDATE creator_profiles
       SET followers_count = (SELECT count(*) FROM creator_follows WHERE creator_id = target)
     WHERE user_id = target;
    RETURN NULL;
END $$;

CREATE TRIGGER creator_follows_count
    AFTER INSERT OR DELETE ON creator_follows
    FOR EACH ROW EXECUTE FUNCTION refresh_followers_count();

-- 10.4 work likes counter
CREATE FUNCTION refresh_work_likes() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    target uuid := COALESCE(NEW.work_id, OLD.work_id);
BEGIN
    UPDATE portfolio_works
       SET likes_count = (SELECT count(*) FROM work_likes WHERE work_id = target)
     WHERE id = target;
    RETURN NULL;
END $$;

CREATE TRIGGER work_likes_count
    AFTER INSERT OR DELETE ON work_likes
    FOR EACH ROW EXECUTE FUNCTION refresh_work_likes();

-- 10.5 order status: stamp dates, write history, count completed projects
CREATE FUNCTION log_order_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO order_events (order_id, actor_id, from_status, to_status)
        VALUES (NEW.id, NEW.client_id, NULL, NEW.status);
        RETURN NEW;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN NEW.completed_at := now(); END IF;
        IF NEW.status = 'cancelled' AND NEW.cancelled_at IS NULL THEN NEW.cancelled_at := now(); END IF;
        IF NEW.status = 'in_review' AND NEW.delivered_at IS NULL THEN NEW.delivered_at := now(); END IF;

        INSERT INTO order_events (order_id, from_status, to_status)
        VALUES (NEW.id, OLD.status, NEW.status);

        IF NEW.status = 'completed' THEN
            UPDATE creator_profiles SET projects_completed = projects_completed + 1
             WHERE user_id = NEW.creator_id;
        ELSIF OLD.status = 'completed' THEN
            UPDATE creator_profiles SET projects_completed = GREATEST(projects_completed - 1, 0)
             WHERE user_id = NEW.creator_id;
        END IF;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER orders_status_insert AFTER  INSERT ON orders FOR EACH ROW EXECUTE FUNCTION log_order_status();
CREATE TRIGGER orders_status_update BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION log_order_status();

-- 10.6 only the client of a completed order may review it
CREATE FUNCTION check_review_allowed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM orders
         WHERE id = NEW.order_id
           AND client_id = NEW.client_id
           AND creator_id = NEW.creator_id
           AND status = 'completed'
    ) THEN
        RAISE EXCEPTION 'Review not allowed: order % is not a completed order between these users', NEW.order_id;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER reviews_check_allowed
    BEFORE INSERT ON reviews
    FOR EACH ROW EXECUTE FUNCTION check_review_allowed();

-- 10.7 new message bumps the conversation and marks the sender as caught up
CREATE FUNCTION on_message_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE conversations c
       SET last_message_at      = NEW.created_at,
           client_last_read_at  = CASE WHEN c.client_id  = NEW.sender_id THEN NEW.created_at ELSE c.client_last_read_at  END,
           creator_last_read_at = CASE WHEN c.creator_id = NEW.sender_id THEN NEW.created_at ELSE c.creator_last_read_at END
     WHERE c.id = NEW.conversation_id
       AND NEW.sender_id IN (c.client_id, c.creator_id);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sender % is not a participant of conversation %', NEW.sender_id, NEW.conversation_id;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER messages_after_insert
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION on_message_insert();

-- ---------------------------------------------------------------------
-- 11. HANDY VIEW: unread messages per user per conversation
-- ---------------------------------------------------------------------
CREATE VIEW conversation_unread AS
SELECT c.id AS conversation_id,
       u.user_id,
       (SELECT count(*) FROM messages m
         WHERE m.conversation_id = c.id
           AND m.sender_id <> u.user_id
           AND m.deleted_at IS NULL
           AND m.created_at > COALESCE(
                 CASE WHEN u.user_id = c.client_id THEN c.client_last_read_at ELSE c.creator_last_read_at END,
                 '-infinity'::timestamptz)
       ) AS unread_count
  FROM conversations c
  CROSS JOIN LATERAL (VALUES (c.client_id), (c.creator_id)) AS u(user_id);

COMMIT;
