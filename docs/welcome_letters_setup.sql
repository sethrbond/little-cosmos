-- Welcome Letters table
-- Allows users to write personal welcome letters to specific email recipients.
-- When the recipient signs up and logs in, they see the letter as a full-screen reveal.

CREATE TABLE welcome_letters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id UUID REFERENCES auth.users(id) NOT NULL,
  from_name TEXT NOT NULL DEFAULT '',
  to_email TEXT NOT NULL,
  letter_text TEXT NOT NULL DEFAULT '',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Index for fast lookup on login
CREATE INDEX idx_welcome_letters_to_email ON welcome_letters(to_email);

-- RLS
ALTER TABLE welcome_letters ENABLE ROW LEVEL SECURITY;

-- Writers can insert and manage their own letters
CREATE POLICY "Users can insert their own letters"
  ON welcome_letters FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can view letters they wrote"
  ON welcome_letters FOR SELECT
  USING (auth.uid() = from_user_id);

CREATE POLICY "Users can update their own letters"
  ON welcome_letters FOR UPDATE
  USING (auth.uid() = from_user_id);

CREATE POLICY "Users can delete their own letters"
  ON welcome_letters FOR DELETE
  USING (auth.uid() = from_user_id);

-- Recipients can read letters addressed to them (by email match)
CREATE POLICY "Recipients can view letters addressed to them"
  ON welcome_letters FOR SELECT
  USING (lower(to_email) = lower(auth.email()));

-- Recipients can mark their letters as read
CREATE POLICY "Recipients can mark letters as read"
  ON welcome_letters FOR UPDATE
  USING (lower(to_email) = lower(auth.email()))
  WITH CHECK (lower(to_email) = lower(auth.email()));
