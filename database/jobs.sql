-- Membership payments and the jobs board.
-- Already part of schema.sql. Run this file ONLY on a database created before it existed:
--   mysql -u root -e "source database/jobs.sql" rawsociety

-- 1. A plan the user has asked for and not yet paid ('pending') must be able to exist next to the plan
--    that is still running, so only running plans count as "the live subscription".
ALTER TABLE subscriptions DROP INDEX subscriptions_one_live_uq;
ALTER TABLE subscriptions DROP COLUMN live_user_id;
ALTER TABLE subscriptions
    ADD COLUMN live_user_id CHAR(36) GENERATED ALWAYS AS
        (IF(status IN ('active','past_due'), user_id, NULL)) STORED,
    ADD UNIQUE KEY subscriptions_one_live_uq (live_user_id);

-- 2. Jobs: a client posts work they need, creators apply with an offer, the client picks one
CREATE TABLE IF NOT EXISTS job_posts (
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

CREATE TABLE IF NOT EXISTS job_post_files (
    job_id  CHAR(36) NOT NULL,
    file_id CHAR(36) NOT NULL,
    PRIMARY KEY (job_id, file_id),
    CONSTRAINT job_post_files_job_fk  FOREIGN KEY (job_id)  REFERENCES job_posts(id) ON DELETE CASCADE,
    CONSTRAINT job_post_files_file_fk FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS job_applications (
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
