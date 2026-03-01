const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PACKAGES = {
  10:  { price: 99,  label: '10 Coins' },
  50:  { price: 399, label: '50 Coins' },
  100: { price: 699, label: '100 Coins' },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { coins, userId, userEmail } = req.body;
    const pkg = PACKAGES[coins];
    if (!pkg) return res.status(400).json({ error: 'Invalid coin package' });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `🪙 ${pkg.label}`,
            description: 'Coins for World Opinion Map',
          },
          unit_amount: pkg.price,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.SITE_URL}?payment=success&coins=${coins}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.SITE_URL}?payment=cancelled`,
      customer_email: userEmail || undefined,
      metadata: { userId, coins: String(coins) },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: err.message });
  }
}
