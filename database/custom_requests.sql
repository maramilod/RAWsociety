-- Custom requests ("Hire me"): a client describes a job and a budget, the creator answers with an offer,
-- and an accepted offer becomes a normal order (awaiting payment).
-- Already part of schema.sql. Run this file ONLY on a database created before it existed:
--   mysql -u root -e "source database/custom_requests.sql" rawsociety

ALTER TABLE files
    MODIFY kind ENUM('avatar','cover','cv','logo','work_media','message_attachment','payment_receipt','delivery','request_attachment') NOT NULL;

CREATE TABLE IF NOT EXISTS custom_requests (
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

CREATE TABLE IF NOT EXISTS custom_request_files (
    request_id CHAR(36) NOT NULL,
    file_id    CHAR(36) NOT NULL,
    PRIMARY KEY (request_id, file_id),
    CONSTRAINT custom_request_files_request_fk FOREIGN KEY (request_id) REFERENCES custom_requests(id) ON DELETE CASCADE,
    CONSTRAINT custom_request_files_file_fk    FOREIGN KEY (file_id)    REFERENCES files(id) ON DELETE CASCADE
) ENGINE=InnoDB;
