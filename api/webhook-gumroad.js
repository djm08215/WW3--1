const { createClient } = require('@supabase/supabase-js');

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    // Gumroad sends form-encoded data
    const body = req.body;
    console.log('Gumroad webhook:', JSON.stringify(body));

    // Only process successful sales
    if (body.resource_name !== 'sale') {
      return res.status(200).json({ received: true });
    }

    const permalink  = body.permalink;
    const customData = body.custom_fields || {};
    
    // userId passed as custom field from frontend
    const userId = customData.user_id || body.custom_fields_values?.user_id;
    const coins  = PRODUCT_COINS[permalink];

    if (!userId || !coins) {
      console.error('Missing userId or unknown product:', { userId, permalink });
      return res.status(200).json({ received: true }); // 200 so Gumroad doesn't retry
    }

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
