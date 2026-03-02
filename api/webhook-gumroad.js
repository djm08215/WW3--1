const { createClient } = require('@supabase/supabase-js');
const querystring = require('querystring');

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Map Gumroad product permalinks to coin amounts
const PRODUCT_COINS = {
  'nukeorlov': 10,
  'xnuvqm':    50,
  'mlptxb':    100,
  'bgyecx':    300,
};

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    // Gumroad sends form-encoded data
    const raw = await getRawBody(req);
    console.log('Gumroad raw ping:', raw);
    const body = querystring.parse(raw);
    // Only process successful sales
    if (body.resource_name !== 'sale') {
      return res.status(200).json({ received: true });
    }

    const permalink = body.permalink;
    const email     = body.email;
    const coins     = PRODUCT_COINS[permalink];

    console.log('Sale data:', { permalink, email, coins });

    if (!email || !coins) {
      console.error('Missing email or unknown product:', { email, permalink });
      return res.status(200).json({ received: true });
    }

    // Look up userId by email in Supabase auth
    const { data: users, error: userError } = await sb.auth.admin.listUsers();
    if (userError) {
      console.error('Failed to list users:', userError);
      return res.status(500).json({ error: 'Failed to find user' });
    }

    const user = users.users.find(u => u.email === email);
    if (!user) {
      console.error('User not found for email:', email);
      return res.status(200).json({ received: true });
    }

    const userId = user.id;

    const { error } = await sb.rpc('add_coins', { user_id_input: userId, amount: coins });
    if (error) {
      console.error('Failed to add coins:', error);
      return res.status(500).json({ error: 'Failed to add coins' });
    }

    console.log(`Added ${coins} coins to user ${userId}`);
    res.status(200).json({ received: true });

  } catch (err) {
    console.error('Gumroad webhook error:', err);
    res.status(500).json({ error: err.message });
  }
}
