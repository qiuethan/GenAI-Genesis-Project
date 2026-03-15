/**
 * Seed mock users and submissions for testing.
 *
 * Prerequisites:
 *   1. Run supabase/migrations/004_seed_mock_challenges.sql in Supabase SQL Editor.
 *   2. Set in .env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY).
 *
 * Run: node scripts/seed-mock-users.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY in .env'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const MOCK_USERS = [
  { email: 'alice@frame.test', password: 'testpass123', username: 'alice', display_name: 'Alice' },
  { email: 'bob@frame.test', password: 'testpass123', username: 'bob', display_name: 'Bob' },
  { email: 'chris@frame.test', password: 'testpass123', username: 'chris', display_name: 'Chris' },
  { email: 'dana@frame.test', password: 'testpass123', username: 'dana', display_name: 'Dana' },
];

// Placeholder images (picsum) so feed shows photos without uploading to Storage
const MOCK_PHOTOS = [
  'https://picsum.photos/400/400?random=10',
  'https://picsum.photos/400/400?random=11',
  'https://picsum.photos/400/400?random=12',
  'https://picsum.photos/400/400?random=13',
  'https://picsum.photos/400/400?random=14',
  'https://picsum.photos/400/400?random=15',
];

const COMPOSITION_TYPES = [
  'center', 'rule_of_thirds', 'golden_ratio', 'triangle',
  'horizontal', 'vertical', 'diagonal', 'symmetric',
  'curved', 'radial', 'vanishing_point', 'pattern', 'fill_the_frame',
];

async function ensureChallenges() {
  const { data, error } = await supabase
    .from('challenges')
    .select('id, title, status')
    .like('title', 'Seed:%');
  if (error) {
    console.error('Failed to fetch challenges:', error.message);
    throw error;
  }
  if (!data?.length) {
    console.warn(
      'No Seed challenges found. Run supabase/migrations/004_seed_mock_challenges.sql first.'
    );
    return [];
  }
  return data;
}

async function createOrGetUser({ email, password, username, display_name }) {
  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users?.find((u) => u.email === email);
  if (found) {
    console.log('  User exists:', email);
    return found.id;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, display_name },
  });
  if (error) {
    console.error('  Create user failed:', email, error.message);
    throw error;
  }
  console.log('  Created:', email);
  return data.user.id;
}

async function updateProfile(userId, { display_name, bio }) {
  const { error } = await supabase
    .from('user_profiles')
    .update({ display_name, bio })
    .eq('id', userId);
  if (error) console.warn('  Profile update warning:', error.message);
}

async function seedSubmissions(userIds, challenges) {
  const activeOrClosed = challenges.filter(
    (c) => c.status === 'ACTIVE' || c.status === 'CLOSED'
  );
  if (!activeOrClosed.length) return;

  let photoIndex = 0;
  const submissions = [];

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];
    const numSubs = 1 + (i % 3);
    for (let j = 0; j < numSubs && j < activeOrClosed.length; j++) {
      const ch = activeOrClosed[j];
      const comp = COMPOSITION_TYPES[j % COMPOSITION_TYPES.length];
      submissions.push({
        challenge_id: ch.id,
        user_id: userId,
        photo_url: MOCK_PHOTOS[photoIndex % MOCK_PHOTOS.length],
        photo_storage_path: `mock/seed/${userId}/${ch.id}.jpg`,
        caption: `Seed submission by user ${i + 1} for ${ch.title}`,
        composition_type: comp,
        score: 70 + Math.floor(Math.random() * 25),
        rank: null,
      });
      photoIndex++;
    }
  }

  for (const row of submissions) {
    const { error } = await supabase.from('submissions').upsert(row, {
      onConflict: 'challenge_id,user_id',
    });
    if (error) console.warn('  Submission upsert warning:', error.message);
  }
  console.log('  Submissions:', submissions.length);
}

async function seedReactionsAndComments(userIds) {
  const { data: subList } = await supabase
    .from('submissions')
    .select('id')
    .limit(12);
  const allSubIds = (subList || []).map((s) => s.id);
  if (!allSubIds.length) return;

  for (let i = 0; i < Math.min(8, allSubIds.length); i++) {
    const subId = allSubIds[i];
    const userId = userIds[i % userIds.length];
    await supabase.from('reactions').upsert(
      { submission_id: subId, user_id: userId },
      { onConflict: 'submission_id,user_id' }
    );
  }

  if (userIds.length >= 2) {
    await supabase.from('comments').insert({
      submission_id: allSubIds[0],
      user_id: userIds[1],
      body: 'Nice shot!',
    });
    await supabase.from('comments').insert({
      submission_id: allSubIds[0],
      user_id: userIds[2],
      body: 'Love the composition.',
    });
  }
  console.log('  Reactions and comments added.');
}

async function main() {
  console.log('Fetching challenges...');
  const challenges = await ensureChallenges();
  if (!challenges.length) {
    console.log('Run 004_seed_mock_challenges.sql first, then run this script again.');
    return;
  }

  console.log('Creating mock users...');
  const userIds = [];
  for (const u of MOCK_USERS) {
    const id = await createOrGetUser(u);
    userIds.push(id);
    await updateProfile(id, {
      display_name: u.display_name,
      bio: u.display_name === 'Alice' ? 'Photography enthusiast.' : null,
    });
  }

  console.log('Seeding submissions...');
  await seedSubmissions(userIds, challenges);

  console.log('Adding reactions and comments...');
  await seedReactionsAndComments(userIds);

  console.log('\nDone. Mock users (password: testpass123):');
  MOCK_USERS.forEach((u, i) => console.log('  ', u.email, '->', u.display_name));
  console.log('\nLog in with any of these in the app to test.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
