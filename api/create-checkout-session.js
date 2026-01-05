import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const { priceId, userId, successUrl, cancelUrl, mode = 'subscription' } = req.body;

  if (!priceId || !userId) {
    return res.status(400).json({ error: 'Missing priceId or userId' });
  }

  try {
    const sessionConfig = {
      mode: mode,
      // Force test email with location to simulate China user
      // This is CRITICAL for testing Alipay/WeChat in Stripe Test Mode
      customer_email: mode === 'payment' ? 'test+location_CN@example.com' : undefined,
      payment_method_types: mode === 'subscription' 
        ? ['card'] 
        : ['card', 'alipay', 'wechat_pay'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      payment_method_options: {
        wechat_pay: {
          client: 'web',
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      metadata: {
        userId: userId,
      },
    };

    const session = await stripe.checkout.sessions.create(sessionConfig);

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
}
