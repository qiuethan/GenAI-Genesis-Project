export type CompositionType =
  | 'center'
  | 'rule_of_thirds'
  | 'golden_ratio'
  | 'triangle'
  | 'horizontal'
  | 'vertical'
  | 'diagonal'
  | 'symmetric'
  | 'curved'
  | 'radial'
  | 'vanishing_point'
  | 'pattern'
  | 'fill_the_frame';

export type ChallengeStatus = 'SCHEDULED' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED';

export const COMPOSITION_LABELS: Record<CompositionType, string> = {
  center: 'Center',
  rule_of_thirds: 'Rule of Thirds',
  golden_ratio: 'Golden Ratio',
  triangle: 'Triangle',
  horizontal: 'Horizontal',
  vertical: 'Vertical',
  diagonal: 'Diagonal',
  symmetric: 'Symmetric',
  curved: 'Curved',
  radial: 'Radial',
  vanishing_point: 'Vanishing Point',
  pattern: 'Pattern',
  fill_the_frame: 'Fill the Frame',
};

// ---- Database row types ----

export interface Challenge {
  id: string;
  title: string;
  composition_type: CompositionType;
  description: string | null;
  cover_image_url: string | null;
  example_image_url: string | null;
  starts_at: string;
  submissions_close_at: string;
  status: ChallengeStatus;
  participant_count: number;
  submission_count: number;
  created_at: string;
}

export interface Submission {
  id: string;
  challenge_id: string;
  user_id: string;
  photo_url: string;
  photo_storage_path: string;
  caption: string | null;
  composition_type: CompositionType;
  submitted_at: string;
  updated_at: string;
  score: number | null;
  score_metadata: ScoreResponse | null;
  rank: number | null;
}

export interface UserProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  composition_badge: string | null;
  challenges_entered: number;
  podium_finishes: number;
  best_rank: number | null;
  avg_score: number | null;
  follower_count: number;
  following_count: number;
  created_at: string;
  updated_at: string;
}

export interface Reaction {
  id: string;
  submission_id: string;
  user_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  submission_id: string;
  user_id: string;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
}

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface SavedPost {
  user_id: string;
  submission_id: string;
  created_at: string;
}

// ---- Scoring engine contract (spec §7) ----

export interface ScoreRequest {
  submission_id: string;
  photo_url: string;
  challenge_composition_type: CompositionType;
}

export interface ScoreResponse {
  submission_id: string;
  score: number;
  composition_scores: Record<CompositionType, number>;
  primary_composition_detected: CompositionType;
  confidence: number;
  metadata: Record<string, unknown>;
}

// ---- Feed item (submission + joined profile) ----

export interface FeedItem extends Submission {
  user: Pick<UserProfile, 'username' | 'display_name' | 'avatar_url' | 'composition_badge'>;
  challenge_title: string;
  reaction_count: number;
  comment_count: number;
  user_has_reacted: boolean;
}
