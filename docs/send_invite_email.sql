-- send_invite_email.sql — Database webhook trigger for email notifications
-- This trigger fires when a new welcome_letter is inserted and calls a
-- Supabase Edge Function to send an email notification.
--
-- SETUP:
-- 1. Deploy the Edge Function (see supabase/functions/send-invite-email/index.ts)
--    OR use Supabase Dashboard > Database > Webhooks to set up a webhook
-- 2. Run this SQL to create the trigger
-- 3. Set RESEND_API_KEY in your Supabase Edge Function secrets
--
-- ALTERNATIVE (no Edge Function): Use pg_net extension to call Resend directly
-- This is simpler and doesn't require deploying a function.

-- ============================================================
-- OPTION A: Direct HTTP call via pg_net (recommended, simpler)
-- ============================================================
-- Enable pg_net if not already enabled:
-- CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION notify_invite_email()
RETURNS TRIGGER AS $$
DECLARE
  resend_key TEXT;
  site_url TEXT := 'https://our-world-kohl.vercel.app';
  email_body TEXT;
BEGIN
  -- Get the API key from vault (set via Supabase Dashboard > Settings > Vault)
  -- Or hardcode for testing: resend_key := 're_xxxxx';
  SELECT decrypted_secret INTO resend_key
  FROM vault.decrypted_secrets
  WHERE name = 'RESEND_API_KEY'
  LIMIT 1;

  -- Skip if no API key configured
  IF resend_key IS NULL OR resend_key = '' THEN
    RAISE NOTICE 'No RESEND_API_KEY found in vault, skipping email';
    RETURN NEW;
  END IF;

  -- Build the email body
  email_body := format(
    '{
      "from": "My Cosmos <noreply@mycosmos.app>",
      "to": ["%s"],
      "subject": "%s has invited you to My Cosmos",
      "html": "<div style=\"font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; background: #0c0a12; color: #e8e0d0;\"><div style=\"text-align: center; margin-bottom: 32px;\"><div style=\"font-size: 12px; letter-spacing: 4px; color: #d0c8e0; text-transform: uppercase;\">My Cosmos</div></div><div style=\"background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px 24px; text-align: center;\"><div style=\"font-size: 18px; font-weight: 500; color: #e8e0d0; margin-bottom: 12px;\">%s sent you an invitation</div><div style=\"font-size: 13px; color: #a098a8; line-height: 1.8; margin-bottom: 20px;\">%s</div><a href=\"%s\" style=\"display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, rgba(200,170,110,0.2), rgba(200,170,110,0.1)); border: 1px solid rgba(200,170,110,0.3); border-radius: 24px; color: #c9a96e; text-decoration: none; font-size: 13px; letter-spacing: 1px;\">Open My Cosmos</a></div><div style=\"text-align: center; margin-top: 24px; font-size: 10px; color: #504858;\">A place to map your adventures on a beautiful 3D globe</div></div>"
    }',
    NEW.to_email,
    COALESCE(NEW.from_name, 'Someone'),
    COALESCE(NEW.from_name, 'Someone'),
    replace(replace(COALESCE(NEW.letter_text, 'You have been invited to join My Cosmos!'), '"', '\"'), E'\n', '<br>'),
    site_url
  );

  -- Send via Resend API using pg_net
  PERFORM net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || resend_key,
      'Content-Type', 'application/json'
    ),
    body := email_body::jsonb
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on welcome_letters INSERT
DROP TRIGGER IF EXISTS on_welcome_letter_send_email ON welcome_letters;
CREATE TRIGGER on_welcome_letter_send_email
  AFTER INSERT ON welcome_letters
  FOR EACH ROW
  EXECUTE FUNCTION notify_invite_email();

-- ============================================================
-- ALSO: Trigger for cosmos_connections (friend sharing invites)
-- ============================================================
CREATE OR REPLACE FUNCTION notify_connection_email()
RETURNS TRIGGER AS $$
DECLARE
  resend_key TEXT;
  site_url TEXT := 'https://our-world-kohl.vercel.app';
  email_body TEXT;
  from_name TEXT;
BEGIN
  SELECT decrypted_secret INTO resend_key
  FROM vault.decrypted_secrets
  WHERE name = 'RESEND_API_KEY'
  LIMIT 1;

  IF resend_key IS NULL OR resend_key = '' THEN
    RETURN NEW;
  END IF;

  from_name := COALESCE(NEW.requester_name, 'Someone');

  email_body := format(
    '{
      "from": "My Cosmos <noreply@mycosmos.app>",
      "to": ["%s"],
      "subject": "%s wants to share worlds with you on My Cosmos",
      "html": "<div style=\"font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; background: #0c0a12; color: #e8e0d0;\"><div style=\"text-align: center; margin-bottom: 32px;\"><div style=\"font-size: 12px; letter-spacing: 4px; color: #d0c8e0; text-transform: uppercase;\">My Cosmos</div></div><div style=\"background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px 24px; text-align: center;\"><div style=\"font-size: 18px; font-weight: 500; color: #e8e0d0; margin-bottom: 12px;\">%s wants to share worlds</div><div style=\"font-size: 13px; color: #a098a8; line-height: 1.8; margin-bottom: 8px;\">Accept their invite and you will both see each other''s travel worlds in your cosmos.</div>%s<a href=\"%s\" style=\"display: inline-block; margin-top: 16px; padding: 12px 32px; background: linear-gradient(135deg, rgba(160,192,232,0.2), rgba(160,192,232,0.1)); border: 1px solid rgba(160,192,232,0.3); border-radius: 24px; color: #a0c0e8; text-decoration: none; font-size: 13px; letter-spacing: 1px;\">Open My Cosmos</a></div><div style=\"text-align: center; margin-top: 24px; font-size: 10px; color: #504858;\">A place to map your adventures on a beautiful 3D globe</div></div>"
    }',
    NEW.target_email,
    from_name,
    from_name,
    CASE WHEN NEW.letter_text IS NOT NULL AND NEW.letter_text != ''
      THEN format('<div style="font-size: 12px; color: #b0a8b8; padding: 14px 16px; background: rgba(255,255,255,0.03); border-radius: 8px; margin: 12px 0; font-style: italic; line-height: 1.6;">"%s"</div>', replace(replace(NEW.letter_text, '"', '\"'), E'\n', '<br>'))
      ELSE ''
    END,
    site_url
  );

  PERFORM net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || resend_key,
      'Content-Type', 'application/json'
    ),
    body := email_body::jsonb
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_connection_send_email ON cosmos_connections;
CREATE TRIGGER on_connection_send_email
  AFTER INSERT ON cosmos_connections
  FOR EACH ROW
  EXECUTE FUNCTION notify_connection_email();

-- ============================================================
-- SETUP INSTRUCTIONS
-- ============================================================
-- 1. Go to Supabase Dashboard > Database > Extensions
--    Enable "pg_net" if not already enabled
--
-- 2. Go to Settings > Vault > Add Secret
--    Name: RESEND_API_KEY
--    Value: re_xxxxxxxxxx (get from resend.com/api-keys)
--
-- 3. At resend.com:
--    - Sign up (free, 100 emails/day)
--    - Add & verify your domain, OR use the free onboarding@resend.dev sender
--    - For testing, change "from" above to "onboarding@resend.dev"
--
-- 4. Run this entire SQL in Supabase SQL Editor
--
-- 5. Test: Create a world invite or friend request — recipient gets email
