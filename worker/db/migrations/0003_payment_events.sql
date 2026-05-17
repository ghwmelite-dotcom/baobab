CREATE TABLE payment_events (
  id TEXT PRIMARY KEY,
  tx_ref TEXT NOT NULL,
  paystack_id INTEGER,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  amount_subunit INTEGER,
  currency TEXT,
  customer_email TEXT,
  raw_event TEXT NOT NULL,
  received_at INTEGER NOT NULL
);
CREATE INDEX idx_payment_events_tx_ref ON payment_events(tx_ref);
CREATE INDEX idx_payment_events_received_at ON payment_events(received_at);
