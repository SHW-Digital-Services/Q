import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const confirmation = process.env.CONFIRM_TEST_PROJECT_REF;
const allowSetup = process.env.ALLOW_TEST_USER_SETUP;

if (!url || !serviceRoleKey) {
  throw new Error(
    'SUPABASE_URL and TEST_SUPABASE_SERVICE_ROLE_KEY are required.'
  );
}

const projectRef = new URL(url).hostname.split('.')[0];

if (allowSetup !== '1' || confirmation !== projectRef) {
  throw new Error(
    'Safety check failed. Set ALLOW_TEST_USER_SETUP=1 and ' +
      `CONFIRM_TEST_PROJECT_REF=${projectRef} after confirming this is the test project.`
  );
}

const users = [
  {
    email: process.env.FREE_USER_EMAIL,
    password: process.env.FREE_USER_PASSWORD,
    role: 'user',
    name: 'Playwright Free User'
  },
  {
    email: process.env.SUBSCRIBER_EMAIL,
    password: process.env.SUBSCRIBER_PASSWORD,
    role: 'user',
    name: 'Playwright Subscriber'
  },
  {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    role: 'partner_admin',
    name: 'Playwright Admin'
  }
] as const;

for (const user of users) {
  if (!user.email || !user.password) {
    throw new Error(`Missing credentials for ${user.name}.`);
  }
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

const listed = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000
});

if (listed.error) {
  throw listed.error;
}

const existingUsers = listed.data.users as Array<{
  id: string;
  email?: string;
}>;

for (const definition of users) {
  const email = definition.email!.trim().toLowerCase();
  let authUser = existingUsers.find(
    candidate => candidate.email?.toLowerCase() === email
  );

  if (!authUser) {
    const created = await supabase.auth.admin.createUser({
      email,
      password: definition.password!,
      email_confirm: true,
      user_metadata: {
        name: definition.name,
        q_test_account: true
      }
    });

    if (created.error) {
      throw new Error(`Could not create ${email}: ${created.error.message}`);
    }

    authUser = created.data.user;
    console.log(`Created ${email}`);
  } else {
    const updated = await supabase.auth.admin.updateUserById(authUser.id, {
      password: definition.password!,
      email_confirm: true,
      user_metadata: {
        name: definition.name,
        q_test_account: true
      }
    });

    if (updated.error) {
      throw new Error(`Could not refresh ${email}: ${updated.error.message}`);
    }

    authUser = updated.data.user;
    console.log(`Refreshed ${email}`);
  }

  const profile = await supabase
    .from('profiles')
    .upsert(
      {
        id: authUser.id,
        preferred_name: definition.name,
        role: definition.role
      },
      { onConflict: 'id' }
    );

  if (profile.error) {
    throw new Error(
      `Could not configure profile for ${email}: ${profile.error.message}`
    );
  }
}

const subscriber = users[1];
const refreshedUsers = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000
});

if (refreshedUsers.error) {
  throw refreshedUsers.error;
}

const subscriberUser = (refreshedUsers.data.users as Array<{
  id: string;
  email?: string;
}>).find(
  candidate => candidate.email?.toLowerCase() === subscriber.email!.toLowerCase()
);

if (!subscriberUser) {
  throw new Error('Subscriber user was not found after setup.');
}

const subscription = await supabase
  .from('subscriptions')
  .upsert(
    {
      user_id: subscriberUser.id,
      paypal_subscription_id: 'TEST-SUBSCRIPTION-MONTHLY',
      paypal_plan_id: 'TEST-PLAN-MONTHLY',
      status: 'ACTIVE',
      current_period_end: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id' }
  );

if (subscription.error) {
  throw new Error(
    `Could not seed subscriber state: ${subscription.error.message}`
  );
}

console.log(
  `Configured ${users.length} users in test project ${projectRef}.`
);
console.log('Remove TEST_SUPABASE_SERVICE_ROLE_KEY from the shell when finished.');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
