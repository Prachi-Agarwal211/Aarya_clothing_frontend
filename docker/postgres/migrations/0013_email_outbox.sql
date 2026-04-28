BEGIN;

-- Email outbox table for reliable async delivery
CREATE TABLE IF NOT EXISTS email_outbox (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    email_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    
    -- Email content snapshot
    to_email VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT NULL,
    
    -- Metadata as JSON
    email_metadata TEXT NULL,
    
    -- Retry state machine
    attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE NULL,
    next_retry_at TIMESTAMP WITH TIME ZONE NULL,
    error_message TEXT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE NULL,
    
    -- Constraints
    CONSTRAINT uq_email_outbox_order_type UNIQUE (order_id, email_type)
);

-- Indexes for worker efficiency
CREATE INDEX IF NOT EXISTS idx_email_outbox_status_retry 
    ON email_outbox (status, next_retry_at) 
    WHERE status IN ('pending', 'retrying');

CREATE INDEX IF NOT EXISTS idx_email_outbox_order_id 
    ON email_outbox (order_id);

CREATE INDEX IF NOT EXISTS idx_email_outbox_user_id 
    ON email_outbox (user_id);

-- Trigger to update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_email_outbox_updated_at ON email_outbox;
CREATE TRIGGER update_email_outbox_updated_at
    BEFORE UPDATE ON email_outbox
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust as needed)
GRANT SELECT, INSERT, UPDATE ON email_outbox TO commerce_user;
GRANT SELECT ON email_outbox TO core_user;

COMMIT;
