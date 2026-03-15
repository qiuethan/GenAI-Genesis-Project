-- ============================================================
-- Composition Challenge — Initial Schema
-- ============================================================

-- --------------------------------------------------------
-- Challenges
-- --------------------------------------------------------
CREATE TABLE public.challenges (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                text NOT NULL,
  composition_type     text NOT NULL CHECK (composition_type IN (
    'center', 'rule_of_thirds', 'golden_ratio', 'triangle',
    'horizontal', 'vertical', 'diagonal', 'symmetric',
    'curved', 'radial', 'vanishing_point', 'pattern', 'fill_the_frame'
  )),
  description          text,
  cover_image_url      text,
  example_image_url    text,
  starts_at            timestamptz NOT NULL,
  submissions_close_at timestamptz NOT NULL,
  status               text NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN (
    'SCHEDULED', 'ACTIVE', 'CLOSED', 'ARCHIVED'
  )),
  participant_count    integer DEFAULT 0,
  submission_count     integer DEFAULT 0,
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX idx_challenges_status_starts ON public.challenges (status, starts_at);
CREATE INDEX idx_challenges_status ON public.challenges (status);

-- --------------------------------------------------------
-- Submissions
-- --------------------------------------------------------
CREATE TABLE public.submissions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id         uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_url            text NOT NULL,
  photo_storage_path   text NOT NULL,
  caption              text CHECK (char_length(caption) <= 280),
  composition_type     text NOT NULL CHECK (composition_type IN (
    'center', 'rule_of_thirds', 'golden_ratio', 'triangle',
    'horizontal', 'vertical', 'diagonal', 'symmetric',
    'curved', 'radial', 'vanishing_point', 'pattern', 'fill_the_frame'
  )),
  submitted_at         timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  score                float,
  score_metadata       jsonb,
  rank                 integer,
  UNIQUE (challenge_id, user_id)
);

CREATE INDEX idx_submissions_challenge_score ON public.submissions (challenge_id, score DESC NULLS LAST);
CREATE INDEX idx_submissions_user ON public.submissions (user_id);
CREATE INDEX idx_submissions_challenge_rank ON public.submissions (challenge_id, rank ASC NULLS LAST);

-- --------------------------------------------------------
-- User Profiles
-- --------------------------------------------------------
CREATE TABLE public.user_profiles (
  id                   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username             text UNIQUE NOT NULL,
  display_name         text,
  avatar_url           text,
  bio                  text CHECK (char_length(bio) <= 160),
  composition_badge    text,
  challenges_entered   integer DEFAULT 0,
  podium_finishes      integer DEFAULT 0,
  best_rank            integer,
  avg_score            float,
  follower_count       integer DEFAULT 0,
  following_count      integer DEFAULT 0,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE INDEX idx_user_profiles_username ON public.user_profiles (username);

-- --------------------------------------------------------
-- Reactions (likes)
-- --------------------------------------------------------
CREATE TABLE public.reactions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id        uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at           timestamptz DEFAULT now(),
  UNIQUE (submission_id, user_id)
);

CREATE INDEX idx_reactions_submission ON public.reactions (submission_id);

-- --------------------------------------------------------
-- Comments (threaded)
-- --------------------------------------------------------
CREATE TABLE public.comments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id        uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_comment_id    uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  body                 text NOT NULL,
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX idx_comments_submission ON public.comments (submission_id, created_at);
CREATE INDEX idx_comments_parent ON public.comments (parent_comment_id);

-- --------------------------------------------------------
-- Follows
-- --------------------------------------------------------
CREATE TABLE public.follows (
  follower_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at           timestamptz DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX idx_follows_following ON public.follows (following_id);

-- --------------------------------------------------------
-- Saved Posts (bookmarks)
-- --------------------------------------------------------
CREATE TABLE public.saved_posts (
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submission_id        uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  created_at           timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, submission_id)
);

-- --------------------------------------------------------
-- Auto-create user_profile on auth.users insert
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'username', 'New User')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------------
-- Updated_at trigger for submissions
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_submissions_updated_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;

-- Challenges: read-only for all authenticated users
CREATE POLICY "challenges_select" ON public.challenges
  FOR SELECT TO authenticated USING (true);

-- Submissions: anyone can read; users can insert/update own rows
CREATE POLICY "submissions_select" ON public.submissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "submissions_insert" ON public.submissions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "submissions_update" ON public.submissions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND score IS NOT DISTINCT FROM (SELECT score FROM public.submissions WHERE id = submissions.id)
    AND rank IS NOT DISTINCT FROM (SELECT rank FROM public.submissions WHERE id = submissions.id)
    AND score_metadata IS NOT DISTINCT FROM (SELECT score_metadata FROM public.submissions WHERE id = submissions.id)
  );

-- User Profiles: anyone can read; users can update own row
CREATE POLICY "user_profiles_select" ON public.user_profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "user_profiles_update" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Reactions: anyone can read; users can insert/delete own
CREATE POLICY "reactions_select" ON public.reactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "reactions_insert" ON public.reactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reactions_delete" ON public.reactions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Comments: anyone can read; users can insert/delete own
CREATE POLICY "comments_select" ON public.comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "comments_insert" ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comments_delete" ON public.comments
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Follows: anyone can read; users can insert/delete own
CREATE POLICY "follows_select" ON public.follows
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "follows_insert" ON public.follows
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "follows_delete" ON public.follows
  FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

-- Saved Posts: users can only see/manage their own
CREATE POLICY "saved_posts_select" ON public.saved_posts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "saved_posts_insert" ON public.saved_posts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_posts_delete" ON public.saved_posts
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- Storage bucket for submission photos
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('submissions', 'submissions', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "submissions_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'submissions' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "submissions_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'submissions');

CREATE POLICY "submissions_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'submissions' AND (storage.foldername(name))[1] = auth.uid()::text);
