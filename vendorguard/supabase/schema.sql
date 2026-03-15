-- VendorGuard Database Schema
-- Run this against your Supabase project to set up the database.

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Tables
-- ============================================================================

-- Vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text        NOT NULL,
  entity_name    text,
  tax_id         text,
  total_submissions int      DEFAULT 0,
  last_submission_at timestamptz,
  risk_history   jsonb       DEFAULT '[]'::jsonb,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id      uuid        NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'processing', 'review', 'approved', 'rejected', 'error')),
  risk_score     text        CHECK (risk_score IN ('LOW', 'MEDIUM', 'HIGH')),
  risk_flags     jsonb       DEFAULT '[]'::jsonb,
  decision       text,
  decision_reason text,
  decision_rule  text,
  decided_at     timestamptz,
  decided_by     text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id             uuid        NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  file_name                 text        NOT NULL,
  file_path                 text        NOT NULL,
  file_size                 int         NOT NULL,
  raw_text                  text,
  document_type             text,
  classification_confidence float,
  extracted_data            jsonb,
  extraction_status         text        NOT NULL DEFAULT 'pending'
                                        CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  flags                     jsonb       DEFAULT '[]'::jsonb,
  created_at                timestamptz DEFAULT now()
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  uuid        REFERENCES submissions(id) ON DELETE CASCADE,
  document_id    uuid        REFERENCES documents(id) ON DELETE SET NULL,
  step           text        NOT NULL,
  severity       text        NOT NULL DEFAULT 'info'
                             CHECK (severity IN ('info', 'warn', 'error', 'critical')),
  message        text        NOT NULL,
  metadata       jsonb       DEFAULT '{}'::jsonb,
  created_at     timestamptz DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_submissions_status
  ON submissions(status);

CREATE INDEX IF NOT EXISTS idx_submissions_vendor_id
  ON submissions(vendor_id);

CREATE INDEX IF NOT EXISTS idx_documents_submission_id
  ON documents(submission_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_submission_id
  ON audit_log(submission_id);

-- ============================================================================
-- Updated_at trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to vendors
DROP TRIGGER IF EXISTS set_vendors_updated_at ON vendors;
CREATE TRIGGER set_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to submissions
DROP TRIGGER IF EXISTS set_submissions_updated_at ON submissions;
CREATE TRIGGER set_submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
