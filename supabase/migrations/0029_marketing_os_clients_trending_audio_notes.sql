-- Per-client trending audio notes.
--
-- No platform exposes competitor trending audio: TikTok pulled trending sounds
-- from Creative Center (the only free, no-auth source), its Research API is
-- academic-only, and Instagram's audio API covers publishing rather than
-- discovery. Rather than infer audio trends from a weak proxy like streaming
-- charts -- which would read as authoritative and be wrong -- this holds what a
-- strategist actually observed in-app, and feeds it to the competitor scan as
-- first-party human observation.
--
-- Note the marketing_os_ prefix: migration 0015 created these as genuinely
-- separate physical tables from the unprefixed originals, and the app queries
-- the prefixed ones exclusively.

alter table if exists public.marketing_os_clients
  add column if not exists trending_audio_notes text;
