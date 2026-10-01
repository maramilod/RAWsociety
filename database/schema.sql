-- =====================================================================
-- RAW Society - MySQL 8.0 schema (InnoDB, utf8mb4)
-- Marketplace connecting creators with clients.
--
-- Run with the mysql client (it understands DELIMITER):
--     mysql -u root -p < database/schema.sql
--     mysql -u root -p rawsociety < database/seed.sql
--
-- Sections
--   1. Identity & auth          (users, accounts, sessions, verification_tokens)
--   2. Profiles                 (categories, files, creator_profiles, creator_links, client_profiles)
--   3. Plans & billing          (plans, subscriptions, payments)
--   4. Catalog                  (services, portfolio_works)
--   5. Social                   (work_likes, creator_follows, saved_creators)
--   6. Orders & reviews         (counters, orders, order_events, reviews)
--   7. Messenger                (conversations, messages)
--   8. Notifications
--   9. Stored procedures & triggers
--  10. Views
--
-- Conventions: uuid (CHAR(36)) primary keys, UTC DATETIME(3) timestamps,
-- money as DECIMAL(12,2) + ISO currency code, soft delete on users.
-- Text comparison is case-insensitive (utf8mb4_unicode_ci), so emails are
-- unique regardless of case.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS rawsociety
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rawsociety;

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ---------------------------------------------------------------------
-- 1. IDENTITY & AUTH  (column names follow the NextAuth/Auth.js adapter)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id              CHAR(36) NOT NULL DEFAULT (UUID()),
    email           VARCHAR(255) NOT NULL,
    email_verified  DATETIME(3) NULL,
    password_hash   VARCHAR(255) NULL,                 -- NULL for Google-only accounts
    name            VARCHAR(120) NOT NULL,
    image           VARCHAR(1000) NULL,                -- avatar URL (Google or uploaded)
    role            ENUM('creator','client','admin') NOT NULL,
    status          ENUM('active','suspended','pending_verification') NOT NULL DEFAULT 'active',
    last_login_at   DATETIME(3) NULL,
    created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at      DATETIME(3) NULL,
    -- unique email among non-deleted users (NULLs never collide)
    email_active    VARCHAR(255) GENERATED ALWAYS AS (IF(deleted_at IS NULL, email, NULL)) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY users_email_active_uq (email_active),
    KEY users_role_idx (role),
    CONSTRAINT users_email_format CHECK (LOCATE('@', email) > 1)
) ENGINE=InnoDB;

-- OAuth links (Google sign-in)
CREATE TABLE accounts (
    id                  CHAR(36) NOT NULL DEFAULT (UUID()),
    user_id             CHAR(36) NOT NULL,
    type                VARCHAR(40)  NOT NULL,
    provider            VARCHAR(40)  NOT NULL,
    provider_account_id VARCHAR(255) NOT NULL,
    refresh_token       TEXT NULL,
    access_token        TEXT NULL,
    expires_at          BIGINT NULL,
    token_type          VARCHAR(40) NULL,
    scope               TEXT NULL,
    id_token            TEXT NULL,
    session_state       TEXT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY accounts_provider_uq (provider, provider_account_id),
    KEY accounts_user_idx (user_id),
    CONSTRAINT accounts_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Only needed if you use database sessions instead of JWT sessions
CREATE TABLE sessions (
    id            CHAR(36) NOT NULL DEFAULT (UUID()),
    session_token VARCHAR(255) NOT NULL,
    user_id       CHAR(36) NOT NULL,
    expires       DATETIME(3) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY sessions_token_uq (session_token),
    KEY sessions_user_idx (user_id),
    CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Email verification / password reset tokens (store a hash, not the raw token)
CREATE TABLE verification_tokens (
    identifier VARCHAR(255) NOT NULL,
    token      VARCHAR(255) NOT NULL,
    expires    DATETIME(3) NOT NULL,
    PRIMARY KEY (identifier, token),
    UNIQUE KEY verification_tokens_token_uq (token)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. PROFILES
-- ---------------------------------------------------------------------
CREATE TABLE categories (
    id         SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    slug       VARCHAR(60)  NOT NULL,
    name       VARCHAR(100) NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    is_active  TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY categories_slug_uq (slug),
    UNIQUE KEY categories_name_uq (name)
) ENGINE=InnoDB;

-- Uploaded files: metadata only, the bytes live in object storage (S3/R2/disk)
CREATE TABLE files (
    id            CHAR(36) NOT NULL DEFAULT (UUID()),
    owner_id      CHAR(36) NOT NULL,
    kind          ENUM('avatar','cover','cv','logo','work_media','message_attachment','payment_receipt','delivery','request_attachment') NOT NULL,
    storage_key   VARCHAR(255) NOT NULL,
    url           VARCHAR(1000) NOT NULL,
    original_name VARCHAR(255) NULL,
    mime_type     VARCHAR(120) NOT NULL,
    size_bytes    BIGINT UNSIGNED NOT NULL,
    created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY files_storage_key_uq (storage_key),
    KEY files_owner_idx (owner_id, kind),
    CONSTRAINT files_owner_fk FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT files_size_chk CHECK (size_bytes > 0)
) ENGINE=InnoDB;

CREATE TABLE creator_profiles (
    user_id            CHAR(36) NOT NULL,
    category_id        SMALLINT UNSIGNED NOT NULL,
    headline           VARCHAR(120) NULL,              -- e.g. "Product & Brand Designer"
    bio                TEXT NULL,
    about              TEXT NULL,
    location           VARCHAR(120) NULL,
    hourly_rate        DECIMAL(10,2) NULL,
    currency           CHAR(3) NOT NULL DEFAULT 'LYD',
    cover_file_id      CHAR(36) NULL,
    cv_file_id         CHAR(36) NULL,
    badge              ENUM('none','pro','featured','top_rated') NOT NULL DEFAULT 'none',
    is_public          TINYINT(1) NOT NULL DEFAULT 1,
    -- denormalised counters, maintained by triggers (section 9)
    rating_avg         DECIMAL(3,2) NOT NULL DEFAULT 0,
    reviews_count      INT UNSIGNED NOT NULL DEFAULT 0,
    followers_count    INT UNSIGNED NOT NULL DEFAULT 0,
    projects_completed INT UNSIGNED NOT NULL DEFAULT 0,
    created_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (user_id),
    KEY creator_profiles_category_idx (category_id, is_public),
    KEY creator_profiles_rating_idx (is_public, rating_avg DESC),
    CONSTRAINT creator_profiles_user_fk     FOREIGN KEY (user_id)       REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT creator_profiles_category_fk FOREIGN KEY (category_id)   REFERENCES categories(id),
    CONSTRAINT creator_profiles_cover_fk    FOREIGN KEY (cover_file_id) REFERENCES files(id) ON DELETE SET NULL,
    CONSTRAINT creator_profiles_cv_fk       FOREIGN KEY (cv_file_id)    REFERENCES files(id) ON DELETE SET NULL,
    CONSTRAINT creator_profiles_rate_chk    CHECK (hourly_rate IS NULL OR hourly_rate >= 0),
    CONSTRAINT creator_profiles_rating_chk  CHECK (rating_avg BETWEEN 0 AND 5)
) ENGINE=InnoDB;

-- Where a creator wants to be paid (one preferred way each). The admin reads it when sending a payout.
CREATE TABLE creator_payout_details (
    user_id        CHAR(36) NOT NULL,
    method         VARCHAR(40) NOT NULL,          -- bank_transfer, sadad, mobicash, local_bank_card
    account_name   VARCHAR(120) NOT NULL,         -- name on the account / wallet / card
    account_number VARCHAR(80) NOT NULL,          -- IBAN or account number, wallet phone number, or card number
    bank_name      VARCHAR(120) NULL,             -- bank transfer and cards only
    created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (user_id),
    CONSTRAINT creator_payout_details_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Behance / Dribbble / GitHub / Drive links from the onboarding form
CREATE TABLE creator_links (
    id         CHAR(36) NOT NULL DEFAULT (UUID()),
    creator_id CHAR(36) NOT NULL,
    label      VARCHAR(60) NULL,
    url        VARCHAR(500) NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY creator_links_uq (creator_id, url),
    CONSTRAINT creator_links_creator_fk FOREIGN KEY (creator_id) REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
    CONSTRAINT creator_links_url_chk CHECK (url REGEXP '^https?://')
) ENGINE=InnoDB;

CREATE TABLE client_profiles (
    user_id             CHAR(36) NOT NULL,
    nickname            VARCHAR(60) NULL,
    company_name        VARCHAR(160) NULL,
    industry            VARCHAR(100) NULL,
    company_size        VARCHAR(40) NULL,
    budget_range        VARCHAR(60) NULL,
    services_needed     JSON NULL,                       -- e.g. ["Design","Photography"]
    project_description TEXT NULL,
    logo_file_id        CHAR(36) NULL,
    created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (user_id),
    CONSTRAINT client_profiles_user_fk FOREIGN KEY (user_id)      REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT client_profiles_logo_fk FOREIGN KEY (logo_file_id) REFERENCES files(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. PLANS & BILLING
-- ---------------------------------------------------------------------
CREATE TABLE plans (
    id               SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code             VARCHAR(40) NOT NULL,              -- 'creator_pro', 'client_enterprise', ...
    audience         ENUM('creator','client') NOT NULL,
    name             VARCHAR(80) NOT NULL,
    price            DECIMAL(10,2) NOT NULL,
    currency         CHAR(3) NOT NULL DEFAULT 'LYD',
    billing_interval ENUM('month','year') NOT NULL DEFAULT 'month',
    limits           JSON NOT NULL DEFAULT (JSON_OBJECT()),   -- e.g. {"max_works":15,"max_briefs":3}
    features         JSON NOT NULL DEFAULT (JSON_ARRAY()),    -- bullet list shown on the plan page
    is_active        TINYINT(1) NOT NULL DEFAULT 1,
    sort_order       SMALLINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY plans_code_uq (code),
    CONSTRAINT plans_price_chk CHECK (price >= 0)
) ENGINE=InnoDB;

CREATE TABLE subscriptions (
    id                   CHAR(36) NOT NULL DEFAULT (UUID()),
    user_id              CHAR(36) NOT NULL,
    plan_id              SMALLINT UNSIGNED NOT NULL,
    status               ENUM('pending','active','past_due','cancelled','expired') NOT NULL DEFAULT 'pending',
    current_period_start DATETIME(3) NULL,
    current_period_end   DATETIME(3) NULL,
    cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
    cancelled_at         DATETIME(3) NULL,
    created_at           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    -- a user can have at most one running subscription; a plan asked for but not yet paid ('pending') sits next to it (NULL = not running)
    live_user_id         CHAR(36) GENERATED ALWAYS AS
                         (IF(status IN ('active','past_due'), user_id, NULL)) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY subscriptions_one_live_uq (live_user_id),
    KEY subscriptions_user_idx (user_id),
    KEY subscriptions_renewal_idx (status, current_period_end),
    -- no ON DELETE CASCADE: billing history must survive, and MySQL forbids cascading
    -- on a column used by the generated live_user_id column. Users are soft-deleted anyway.
    CONSTRAINT subscriptions_user_fk FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT subscriptions_plan_fk FOREIGN KEY (plan_id) REFERENCES plans(id),
    CONSTRAINT subscriptions_period_chk CHECK (current_period_end IS NULL OR current_period_end > current_period_start)
) ENGINE=InnoDB;

CREATE TABLE payments (
    id              CHAR(36) NOT NULL DEFAULT (UUID()),
    user_id         CHAR(36) NOT NULL,
    subscription_id CHAR(36) NULL,
    order_id        CHAR(36) NULL,                      -- FK added after orders exists
    amount          DECIMAL(12,2) NOT NULL,
    currency        CHAR(3) NOT NULL DEFAULT 'LYD',
    method          VARCHAR(40) NOT NULL,               -- provider id: 'sadad', 'mobicash', 'local_bank_card', 'bank_transfer', ... (new providers need no migration)
    status          ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
    provider_ref    VARCHAR(120) NULL,                  -- Sadad / Mobicash / bank transaction number (optional)
    sender_name     VARCHAR(120) NULL,                  -- who sent the money, as the client reports it
    sender_bank     VARCHAR(120) NULL,                  -- the client's bank or wallet
    paid_amount     DECIMAL(12,2) NULL,                 -- the amount the client says was sent (the admin compares it with the account)
    receipt_file_id CHAR(36) NULL,                      -- photo of the transfer receipt (private file)
    failure_reason  TEXT NULL,
    provider_meta   JSON NULL,                          -- raw data from a payment gateway, when there is one
    paid_at         DATETIME(3) NULL,
    confirmed_by    CHAR(36) NULL,                      -- the admin who confirmed a manual payment
    confirmed_at    DATETIME(3) NULL,
    created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY payments_provider_ref_uq (method, provider_ref),   -- NULL refs never collide; one transfer cannot pay two orders
    KEY payments_user_idx (user_id, created_at),
    CONSTRAINT payments_user_fk FOREIGN KEY (user_id)         REFERENCES users(id),
    CONSTRAINT payments_confirmed_by_fk FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT payments_receipt_fk FOREIGN KEY (receipt_file_id) REFERENCES files(id) ON DELETE SET NULL,
    CONSTRAINT payments_sub_fk  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
    CONSTRAINT payments_amount_chk CHECK (amount >= 0),
    -- pays for a plan OR an order, never both, never neither
    CONSTRAINT payments_target_chk CHECK ((subscription_id IS NOT NULL) + (order_id IS NOT NULL) = 1),
    CONSTRAINT payments_paid_chk   CHECK (status <> 'paid' OR paid_at IS NOT NULL)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. CATALOG
-- ---------------------------------------------------------------------
-- Services a creator sells ("+ New Service" on the creator dashboard)
CREATE TABLE services (
    id            CHAR(36) NOT NULL DEFAULT (UUID()),
    creator_id    CHAR(36) NOT NULL,
    category_id   SMALLINT UNSIGNED NOT NULL,
    title         VARCHAR(160) NOT NULL,
    description   TEXT NULL,
    price         DECIMAL(12,2) NOT NULL,
    currency      CHAR(3) NOT NULL DEFAULT 'LYD',
    delivery_days SMALLINT UNSIGNED NULL,
    revisions     SMALLINT UNSIGNED NULL,                 -- number of revisions included
    tags          JSON NULL,                              -- skills/tools, e.g. ["React","Figma"]
    deliverables  JSON NULL,                              -- "What's included" bullet list
    requirements  TEXT NULL,                              -- what the creator needs from the client
    is_active     TINYINT(1) NOT NULL DEFAULT 1,
    created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY services_creator_idx (creator_id, is_active),
    KEY services_category_idx (category_id, is_active),
    CONSTRAINT services_creator_fk  FOREIGN KEY (creator_id)  REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
    CONSTRAINT services_category_fk FOREIGN KEY (category_id) REFERENCES categories(id),
    CONSTRAINT services_price_chk CHECK (price >= 0),
    CONSTRAINT services_days_chk  CHECK (delivery_days IS NULL OR delivery_days > 0)
) ENGINE=InnoDB;

-- Gallery of a service: sort_order 0 is the cover image
CREATE TABLE service_images (
    id         CHAR(36) NOT NULL DEFAULT (UUID()),
    service_id CHAR(36) NOT NULL,
    file_id    CHAR(36) NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY service_images_file_uq (file_id),
    KEY service_images_service_idx (service_id, sort_order),
    CONSTRAINT service_images_service_fk FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    CONSTRAINT service_images_file_fk    FOREIGN KEY (file_id)    REFERENCES files(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- External links of a service (GitHub repo, live demo, Behance, Figma, video, ...)
CREATE TABLE service_links (
    id         CHAR(36) NOT NULL DEFAULT (UUID()),
    service_id CHAR(36) NOT NULL,
    kind       ENUM('github','demo','website','behance','dribbble','figma','youtube','vimeo','drive','other') NOT NULL DEFAULT 'other',
    label      VARCHAR(60) NULL,
    url        VARCHAR(500) NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY service_links_service_idx (service_id, sort_order),
    CONSTRAINT service_links_service_fk FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    CONSTRAINT service_links_url_chk CHECK (url REGEXP '^https?://')
) ENGINE=InnoDB;

-- Portfolio pieces shown on creator profiles / Featured Work
CREATE TABLE portfolio_works (
    id            CHAR(36) NOT NULL DEFAULT (UUID()),
    creator_id    CHAR(36) NOT NULL,
    category_id   SMALLINT UNSIGNED NULL,
    title         VARCHAR(160) NOT NULL,
    description   TEXT NULL,
    cover_file_id CHAR(36) NULL,
    price         DECIMAL(10,2) NULL,                   -- NULL = not for sale
    currency      CHAR(3) NOT NULL DEFAULT 'USD',
    is_featured   TINYINT(1) NOT NULL DEFAULT 0,
    likes_count   INT UNSIGNED NOT NULL DEFAULT 0,
    created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY portfolio_works_creator_idx (creator_id, created_at),
    KEY portfolio_works_featured_idx (is_featured, likes_count DESC),
    CONSTRAINT portfolio_works_creator_fk  FOREIGN KEY (creator_id)    REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
    CONSTRAINT portfolio_works_category_fk FOREIGN KEY (category_id)   REFERENCES categories(id),
    CONSTRAINT portfolio_works_cover_fk    FOREIGN KEY (cover_file_id) REFERENCES files(id) ON DELETE SET NULL,
    CONSTRAINT portfolio_works_price_chk   CHECK (price IS NULL OR price >= 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. SOCIAL
-- ---------------------------------------------------------------------
CREATE TABLE work_likes (
    work_id    CHAR(36) NOT NULL,
    user_id    CHAR(36) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (work_id, user_id),
    KEY work_likes_user_idx (user_id),
    CONSTRAINT work_likes_work_fk FOREIGN KEY (work_id) REFERENCES portfolio_works(id) ON DELETE CASCADE,
    CONSTRAINT work_likes_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- (MySQL forbids CHECK constraints on columns with ON DELETE CASCADE, so the
--  "cannot follow / save yourself" rules are enforced by triggers in section 9.)
CREATE TABLE creator_follows (
    follower_id CHAR(36) NOT NULL,
    creator_id  CHAR(36) NOT NULL,
    created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (follower_id, creator_id),
    KEY creator_follows_creator_idx (creator_id),
    CONSTRAINT creator_follows_follower_fk FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT creator_follows_creator_fk  FOREIGN KEY (creator_id)  REFERENCES creator_profiles(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Client bookmarks ("Saved Creators" on the client dashboard)
CREATE TABLE saved_creators (
    client_id  CHAR(36) NOT NULL,
    creator_id CHAR(36) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (client_id, creator_id),
    KEY saved_creators_creator_idx (creator_id),
    CONSTRAINT saved_creators_client_fk  FOREIGN KEY (client_id)  REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT saved_creators_creator_fk FOREIGN KEY (creator_id) REFERENCES creator_profiles(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. ORDERS & REVIEWS
-- ---------------------------------------------------------------------
-- MySQL has no sequences: a tiny counter table feeds order numbers (ORD-101, ...)
CREATE TABLE counters (
    name  VARCHAR(40) NOT NULL,
    value BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (name)
) ENGINE=InnoDB;
INSERT INTO counters (name, value) VALUES ('order_number', 100);

CREATE TABLE orders (
    id            CHAR(36) NOT NULL DEFAULT (UUID()),
    order_number  VARCHAR(20) NOT NULL DEFAULT '',       -- filled by trigger: ORD-101 ...
    client_id     CHAR(36) NOT NULL,
    creator_id    CHAR(36) NOT NULL,
    service_id    CHAR(36) NULL,
    title         VARCHAR(160) NOT NULL,                 -- snapshot of the service name
    brief         TEXT NULL,
    amount        DECIMAL(12,2) NOT NULL,
    currency      CHAR(3) NOT NULL DEFAULT 'LYD',
    status        ENUM('pending','awaiting_payment','in_progress','in_review','completed','cancelled','disputed') NOT NULL DEFAULT 'pending',
    due_date      DATE NULL,
    payment_due_at DATETIME(3) NULL,                    -- the client must pay before this, or the order expires
    paid_at       DATETIME(3) NULL,                     -- when the payment was confirmed (money is now held by the platform)
    payout_status ENUM('none','held','released','paid_out') NOT NULL DEFAULT 'none',
                                                        -- held = in escrow, released = approved by the client, paid_out = sent to the creator
    platform_fee  DECIMAL(12,2) NULL,                   -- the platform's commission
    creator_payout DECIMAL(12,2) NULL,                  -- amount minus commission: what the creator receives
    revisions_allowed SMALLINT UNSIGNED NULL,           -- revisions the client may ask for (copied from the service when booked)
    revisions_used    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    delivered_at  DATETIME(3) NULL,
    completed_at  DATETIME(3) NULL,
    cancelled_at  DATETIME(3) NULL,
    cancelled_by  ENUM('client','creator','system','admin') NULL, -- client withdrew, creator declined, or system = payment window expired
    created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY orders_number_uq (order_number),
    KEY orders_client_idx  (client_id,  status, created_at),
    KEY orders_creator_idx (creator_id, status, created_at),
    KEY orders_payment_idx (status, payment_due_at),
    CONSTRAINT orders_client_fk  FOREIGN KEY (client_id)  REFERENCES users(id),
    CONSTRAINT orders_creator_fk FOREIGN KEY (creator_id) REFERENCES creator_profiles(user_id),
    CONSTRAINT orders_service_fk FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
    CONSTRAINT orders_amount_chk CHECK (amount >= 0),
    CONSTRAINT orders_parties_chk CHECK (client_id <> creator_id),
    CONSTRAINT orders_completed_chk CHECK (status <> 'completed' OR completed_at IS NOT NULL)
) ENGINE=InnoDB;

ALTER TABLE payments
    ADD CONSTRAINT payments_order_fk FOREIGN KEY (order_id) REFERENCES orders(id);

-- Status history / audit trail
CREATE TABLE order_events (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id    CHAR(36) NOT NULL,
    actor_id    CHAR(36) NULL,
    from_status ENUM('pending','awaiting_payment','in_progress','in_review','completed','cancelled','disputed') NULL,
    to_status   ENUM('pending','awaiting_payment','in_progress','in_review','completed','cancelled','disputed') NOT NULL,
    note        TEXT NULL,
    created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY order_events_order_idx (order_id, created_at),
    CONSTRAINT order_events_order_fk FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT order_events_actor_fk FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- One review per completed order, written by the client
CREATE TABLE reviews (
    id          CHAR(36) NOT NULL DEFAULT (UUID()),
    order_id    CHAR(36) NOT NULL,
    client_id   CHAR(36) NOT NULL,
    creator_id  CHAR(36) NOT NULL,
    rating      TINYINT UNSIGNED NOT NULL,
    comment     TEXT NULL,
    created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY reviews_order_uq (order_id),
    KEY reviews_creator_idx (creator_id, created_at),
    CONSTRAINT reviews_order_fk   FOREIGN KEY (order_id)   REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT reviews_client_fk  FOREIGN KEY (client_id)  REFERENCES users(id),
    CONSTRAINT reviews_creator_fk FOREIGN KEY (creator_id) REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
    CONSTRAINT reviews_rating_chk CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Delivery of the work, inside the site
-- ---------------------------------------------------------------------
-- One row per delivery. Every revision round is a new delivery (round 1, 2, ...).
CREATE TABLE deliveries (
    id          CHAR(36) NOT NULL DEFAULT (UUID()),
    order_id    CHAR(36) NOT NULL,
    round       SMALLINT UNSIGNED NOT NULL,
    message     TEXT NULL,
    access_note VARCHAR(500) NULL,                       -- e.g. "You were invited to the private repository"
    created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY deliveries_order_round_uq (order_id, round),
    CONSTRAINT deliveries_order_fk FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Files of a delivery (private: only the client, the creator and admins can download them)
CREATE TABLE delivery_files (
    id          CHAR(36) NOT NULL DEFAULT (UUID()),
    delivery_id CHAR(36) NOT NULL,
    file_id     CHAR(36) NOT NULL,
    sort_order  SMALLINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY delivery_files_file_uq (file_id),
    KEY delivery_files_delivery_idx (delivery_id, sort_order),
    CONSTRAINT delivery_files_delivery_fk FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
    CONSTRAINT delivery_files_file_fk     FOREIGN KEY (file_id)     REFERENCES files(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Links of a delivery (GitHub repository, Figma file, Drive folder, live site, ...)
CREATE TABLE delivery_links (
    id          CHAR(36) NOT NULL DEFAULT (UUID()),
    delivery_id CHAR(36) NOT NULL,
    kind        ENUM('github','demo','website','behance','dribbble','figma','youtube','vimeo','drive','other') NOT NULL DEFAULT 'other',
    label       VARCHAR(60) NULL,
    url         VARCHAR(500) NOT NULL,
    sort_order  SMALLINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY delivery_links_delivery_idx (delivery_id, sort_order),
    CONSTRAINT delivery_links_delivery_fk FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
    CONSTRAINT delivery_links_url_chk CHECK (url REGEXP '^https?://')
) ENGINE=InnoDB;

-- Written notes on an order: a revision request, a reported problem, or the admin's decision
CREATE TABLE order_notes (
    id         CHAR(36) NOT NULL DEFAULT (UUID()),
    order_id   CHAR(36) NOT NULL,
    author_id  CHAR(36) NULL,
    kind       ENUM('revision_request','dispute','dispute_resolution') NOT NULL,
    body       TEXT NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY order_notes_order_idx (order_id, created_at),
    CONSTRAINT order_notes_order_fk  FOREIGN KEY (order_id)  REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT order_notes_author_fk FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Custom requests ("Hire me"): the client describes a job and a budget, the creator answers with an offer,
-- and an accepted offer becomes a normal order (awaiting payment).
CREATE TABLE custom_requests (
    id            CHAR(36) NOT NULL DEFAULT (UUID()),
    client_id     CHAR(36) NOT NULL,
    creator_id    CHAR(36) NOT NULL,
    base_service_id CHAR(36) NULL,                        -- the service the client started from, if any
    category      VARCHAR(120) NOT NULL DEFAULT '',       -- the creator's specialty when the request was sent
    title         VARCHAR(160) NOT NULL,
    summary       TEXT NOT NULL,
    brief         TEXT NULL,
    goals         TEXT NULL,
    language      VARCHAR(40) NOT NULL DEFAULT '',
    details       JSON NULL,                              -- answers to the specialty questions, by field key
    links         JSON NULL,                              -- [{ kind, label, url }]
    budget_type   ENUM('fixed','range','hourly','quote') NOT NULL,
    budget_amount DECIMAL(12,2) NULL,                     -- fixed price, lowest of a range, or the hourly total
    budget_max    DECIMAL(12,2) NULL,
    hourly_rate   DECIMAL(12,2) NULL,
    hours         DECIMAL(8,2) NULL,
    currency      CHAR(3) NOT NULL DEFAULT 'LYD',
    deadline      DATE NULL,
    rush          TINYINT(1) NOT NULL DEFAULT 0,
    revisions     SMALLINT UNSIGNED NOT NULL DEFAULT 2,
    usage_rights  VARCHAR(80) NOT NULL DEFAULT '',
    nda           TINYINT(1) NOT NULL DEFAULT 0,
    portfolio     TINYINT(1) NOT NULL DEFAULT 0,
    source_files  TINYINT(1) NOT NULL DEFAULT 0,
    contact       VARCHAR(80) NOT NULL DEFAULT '',
    questions     TEXT NULL,
    status        ENUM('open','offered','accepted','declined','cancelled','expired') NOT NULL DEFAULT 'open',
    offer_price   DECIMAL(12,2) NULL,                     -- the creator's offer
    offer_days    SMALLINT UNSIGNED NULL,
    offer_message TEXT NULL,
    decline_note  TEXT NULL,
    order_id      CHAR(36) NULL,                          -- the order created when the client accepted the offer
    expires_at    DATETIME(3) NOT NULL,                   -- unanswered requests and offers end on their own
    created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY custom_requests_client_idx  (client_id,  status, created_at),
    KEY custom_requests_creator_idx (creator_id, status, created_at),
    KEY custom_requests_expiry_idx  (status, expires_at),
    CONSTRAINT custom_requests_client_fk  FOREIGN KEY (client_id)  REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT custom_requests_creator_fk FOREIGN KEY (creator_id) REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
    CONSTRAINT custom_requests_service_fk FOREIGN KEY (base_service_id) REFERENCES services(id) ON DELETE SET NULL,
    CONSTRAINT custom_requests_order_fk   FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE custom_request_files (
    request_id CHAR(36) NOT NULL,
    file_id    CHAR(36) NOT NULL,
    PRIMARY KEY (request_id, file_id),
    CONSTRAINT custom_request_files_request_fk FOREIGN KEY (request_id) REFERENCES custom_requests(id) ON DELETE CASCADE,
    CONSTRAINT custom_request_files_file_fk    FOREIGN KEY (file_id)    REFERENCES files(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Jobs board: a client posts work, creators apply with an offer, the client picks one (an order is created)
CREATE TABLE job_posts (
    id            CHAR(36) NOT NULL DEFAULT (UUID()),
    client_id     CHAR(36) NOT NULL,
    category_id   SMALLINT UNSIGNED NOT NULL,
    title         VARCHAR(160) NOT NULL,
    summary       TEXT NOT NULL,
    brief         TEXT NULL,
    details       JSON NULL,                              -- answers to the specialty questions, by field key
    links         JSON NULL,                              -- [{ kind, label, url }]
    budget_type   ENUM('fixed','range','quote') NOT NULL,
    budget_amount DECIMAL(12,2) NULL,
    budget_max    DECIMAL(12,2) NULL,
    currency      CHAR(3) NOT NULL DEFAULT 'LYD',
    deadline      DATE NULL,
    status        ENUM('open','filled','closed','expired') NOT NULL DEFAULT 'open',
    expires_at    DATETIME(3) NOT NULL,
    created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY job_posts_client_idx (client_id, status, created_at),
    KEY job_posts_open_idx   (status, category_id, created_at),
    KEY job_posts_expiry_idx (status, expires_at),
    CONSTRAINT job_posts_client_fk   FOREIGN KEY (client_id)   REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT job_posts_category_fk FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB;

CREATE TABLE job_post_files (
    job_id  CHAR(36) NOT NULL,
    file_id CHAR(36) NOT NULL,
    PRIMARY KEY (job_id, file_id),
    CONSTRAINT job_post_files_job_fk  FOREIGN KEY (job_id)  REFERENCES job_posts(id) ON DELETE CASCADE,
    CONSTRAINT job_post_files_file_fk FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE job_applications (
    id         CHAR(36) NOT NULL DEFAULT (UUID()),
    job_id     CHAR(36) NOT NULL,
    creator_id CHAR(36) NOT NULL,
    price      DECIMAL(12,2) NOT NULL,
    days       SMALLINT UNSIGNED NOT NULL,
    message    TEXT NULL,
    links      JSON NULL,                                 -- earlier work the creator wants to show
    status     ENUM('pending','accepted','rejected','withdrawn') NOT NULL DEFAULT 'pending',
    order_id   CHAR(36) NULL,                             -- the order created when the client accepted
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY job_applications_once_uq (job_id, creator_id),     -- one application per creator and job
    KEY job_applications_creator_idx (creator_id, created_at),
    CONSTRAINT job_applications_job_fk     FOREIGN KEY (job_id)     REFERENCES job_posts(id) ON DELETE CASCADE,
    CONSTRAINT job_applications_creator_fk FOREIGN KEY (creator_id) REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
    CONSTRAINT job_applications_order_fk   FOREIGN KEY (order_id)   REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. MESSENGER  (one conversation per client/creator pair)
-- ---------------------------------------------------------------------
CREATE TABLE conversations (
    id                    CHAR(36) NOT NULL DEFAULT (UUID()),
    client_id             CHAR(36) NOT NULL,
    creator_id            CHAR(36) NOT NULL,
    client_last_read_at   DATETIME(3) NULL,
    creator_last_read_at  DATETIME(3) NULL,
    last_message_at       DATETIME(3) NULL,
    created_at            DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY conversations_pair_uq (client_id, creator_id),
    KEY conversations_client_idx  (client_id,  last_message_at),
    KEY conversations_creator_idx (creator_id, last_message_at),
    CONSTRAINT conversations_client_fk  FOREIGN KEY (client_id)  REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT conversations_creator_fk FOREIGN KEY (creator_id) REFERENCES creator_profiles(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE messages (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    conversation_id CHAR(36) NOT NULL,
    sender_id       CHAR(36) NOT NULL,
    order_id        CHAR(36) NULL,                       -- optional: message about an order
    body            TEXT NOT NULL,
    attachment_id   CHAR(36) NULL,
    created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    edited_at       DATETIME(3) NULL,
    deleted_at      DATETIME(3) NULL,
    PRIMARY KEY (id),
    KEY messages_conversation_idx (conversation_id, id),
    CONSTRAINT messages_conversation_fk FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT messages_sender_fk       FOREIGN KEY (sender_id)       REFERENCES users(id),
    CONSTRAINT messages_order_fk        FOREIGN KEY (order_id)        REFERENCES orders(id) ON DELETE SET NULL,
    CONSTRAINT messages_attachment_fk   FOREIGN KEY (attachment_id)   REFERENCES files(id) ON DELETE SET NULL,
    CONSTRAINT messages_body_chk CHECK (CHAR_LENGTH(TRIM(body)) > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. NOTIFICATIONS
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
    id         CHAR(36) NOT NULL DEFAULT (UUID()),
    user_id    CHAR(36) NOT NULL,
    type       ENUM('new_message','order_update','payment','review','follow','system') NOT NULL,
    title      VARCHAR(160) NOT NULL,
    data       JSON NOT NULL DEFAULT (JSON_OBJECT()),
    read_at    DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY notifications_user_idx (user_id, read_at, created_at),
    CONSTRAINT notifications_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 9. STORED PROCEDURES & TRIGGERS
-- (updated_at is handled by ON UPDATE CURRENT_TIMESTAMP, no trigger needed)
-- ---------------------------------------------------------------------
DELIMITER $$

-- 9.1 creator rating / review counter
CREATE PROCEDURE refresh_creator_rating(IN p_creator CHAR(36))
BEGIN
    UPDATE creator_profiles
       SET rating_avg    = COALESCE((SELECT ROUND(AVG(rating), 2) FROM reviews WHERE creator_id = p_creator), 0),
           reviews_count = (SELECT COUNT(*) FROM reviews WHERE creator_id = p_creator)
     WHERE user_id = p_creator;
END$$

CREATE TRIGGER reviews_ai AFTER INSERT ON reviews FOR EACH ROW
BEGIN
    CALL refresh_creator_rating(NEW.creator_id);
END$$

CREATE TRIGGER reviews_au AFTER UPDATE ON reviews FOR EACH ROW
BEGIN
    CALL refresh_creator_rating(NEW.creator_id);
END$$

CREATE TRIGGER reviews_ad AFTER DELETE ON reviews FOR EACH ROW
BEGIN
    CALL refresh_creator_rating(OLD.creator_id);
END$$

-- 9.2 only the client of a completed order may review it
CREATE TRIGGER reviews_bi BEFORE INSERT ON reviews FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM orders
         WHERE id = NEW.order_id
           AND client_id = NEW.client_id
           AND creator_id = NEW.creator_id
           AND status = 'completed'
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Review not allowed: order is not a completed order between these users';
    END IF;
END$$

-- 9.3 follower counter + no self-follow
CREATE TRIGGER creator_follows_bi BEFORE INSERT ON creator_follows FOR EACH ROW
BEGIN
    IF NEW.follower_id = NEW.creator_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A user cannot follow themselves';
    END IF;
END$$

CREATE TRIGGER creator_follows_ai AFTER INSERT ON creator_follows FOR EACH ROW
BEGIN
    UPDATE creator_profiles
       SET followers_count = (SELECT COUNT(*) FROM creator_follows WHERE creator_id = NEW.creator_id)
     WHERE user_id = NEW.creator_id;
END$$

CREATE TRIGGER creator_follows_ad AFTER DELETE ON creator_follows FOR EACH ROW
BEGIN
    UPDATE creator_profiles
       SET followers_count = (SELECT COUNT(*) FROM creator_follows WHERE creator_id = OLD.creator_id)
     WHERE user_id = OLD.creator_id;
END$$

-- 9.4 no saving yourself
CREATE TRIGGER saved_creators_bi BEFORE INSERT ON saved_creators FOR EACH ROW
BEGIN
    IF NEW.client_id = NEW.creator_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A user cannot save themselves';
    END IF;
END$$

-- 9.5 work likes counter
CREATE TRIGGER work_likes_ai AFTER INSERT ON work_likes FOR EACH ROW
BEGIN
    UPDATE portfolio_works
       SET likes_count = (SELECT COUNT(*) FROM work_likes WHERE work_id = NEW.work_id)
     WHERE id = NEW.work_id;
END$$

CREATE TRIGGER work_likes_ad AFTER DELETE ON work_likes FOR EACH ROW
BEGIN
    UPDATE portfolio_works
       SET likes_count = (SELECT COUNT(*) FROM work_likes WHERE work_id = OLD.work_id)
     WHERE id = OLD.work_id;
END$$

-- 9.6 orders: number (ORD-101...), stamp dates, history, completed-projects counter
CREATE TRIGGER orders_bi BEFORE INSERT ON orders FOR EACH ROW
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        UPDATE counters SET value = LAST_INSERT_ID(value + 1) WHERE name = 'order_number';
        SET NEW.order_number = CONCAT('ORD-', LAST_INSERT_ID());
    END IF;
END$$

CREATE TRIGGER orders_ai AFTER INSERT ON orders FOR EACH ROW
BEGIN
    INSERT INTO order_events (order_id, actor_id, from_status, to_status)
    VALUES (NEW.id, NEW.client_id, NULL, NEW.status);
END$$

CREATE TRIGGER orders_bu BEFORE UPDATE ON orders FOR EACH ROW
BEGIN
    IF NEW.status <> OLD.status THEN
        IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN SET NEW.completed_at = NOW(3); END IF;
        IF NEW.status = 'cancelled' AND NEW.cancelled_at IS NULL THEN SET NEW.cancelled_at = NOW(3); END IF;
        IF NEW.status = 'in_review' AND NEW.delivered_at IS NULL THEN SET NEW.delivered_at = NOW(3); END IF;
    END IF;
END$$

CREATE TRIGGER orders_au AFTER UPDATE ON orders FOR EACH ROW
BEGIN
    IF NEW.status <> OLD.status THEN
        INSERT INTO order_events (order_id, from_status, to_status)
        VALUES (NEW.id, OLD.status, NEW.status);

        IF NEW.status = 'completed' THEN
            UPDATE creator_profiles SET projects_completed = projects_completed + 1
             WHERE user_id = NEW.creator_id;
        ELSEIF OLD.status = 'completed' THEN
            UPDATE creator_profiles SET projects_completed = GREATEST(projects_completed, 1) - 1
             WHERE user_id = NEW.creator_id;
        END IF;
    END IF;
END$$

-- 9.7 messenger: no self-conversation, only participants can post,
--     a new message bumps the conversation and marks the sender as caught up
CREATE TRIGGER conversations_bi BEFORE INSERT ON conversations FOR EACH ROW
BEGIN
    IF NEW.client_id = NEW.creator_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A conversation needs two different users';
    END IF;
END$$

CREATE TRIGGER messages_bi BEFORE INSERT ON messages FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM conversations
         WHERE id = NEW.conversation_id
           AND NEW.sender_id IN (client_id, creator_id)
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sender is not a participant of this conversation';
    END IF;
END$$

CREATE TRIGGER messages_ai AFTER INSERT ON messages FOR EACH ROW
BEGIN
    UPDATE conversations
       SET last_message_at      = NEW.created_at,
           client_last_read_at  = IF(client_id  = NEW.sender_id, NEW.created_at, client_last_read_at),
           creator_last_read_at = IF(creator_id = NEW.sender_id, NEW.created_at, creator_last_read_at)
     WHERE id = NEW.conversation_id;
END$$

DELIMITER ;

-- ---------------------------------------------------------------------
-- 10. VIEWS
-- ---------------------------------------------------------------------
-- Unread messages per user per conversation
CREATE VIEW conversation_unread AS
SELECT c.id AS conversation_id,
       p.user_id,
       (SELECT COUNT(*) FROM messages m
         WHERE m.conversation_id = c.id
           AND m.sender_id <> p.user_id
           AND m.deleted_at IS NULL
           AND m.created_at > COALESCE(p.last_read_at, '1000-01-01')
       ) AS unread_count
  FROM conversations c
  JOIN (
        SELECT id AS conversation_id, client_id  AS user_id, client_last_read_at  AS last_read_at FROM conversations
        UNION ALL
        SELECT id,                    creator_id,            creator_last_read_at FROM conversations
       ) p ON p.conversation_id = c.id;
