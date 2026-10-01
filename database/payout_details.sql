-- Where a creator wants to be paid (one preferred way each). The admin reads it when sending a payout.
-- Run once on an existing database. New installs get it from schema.sql.
CREATE TABLE IF NOT EXISTS creator_payout_details (
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
