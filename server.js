import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

console.log('--- Server Startup Debug ---');
console.log('Current Directory:', process.cwd());
console.log('STRIPE_SECRET_KEY Length:', process.env.STRIPE_SECRET_KEY ? process.env.STRIPE_SECRET_KEY.length : 'undefined');
if (process.env.STRIPE_SECRET_KEY) {
    console.log('STRIPE_SECRET_KEY Prefix:', process.env.STRIPE_SECRET_KEY.substring(0, 10) + '...');
} else {
    console.log('Error: STRIPE_SECRET_KEY is missing from .env file');
}
console.log('----------------------------');

const app = express();
const port = 3001;

// Define routes with /api prefix to match Vercel structure and Vite proxy
const API_PREFIX = '/api';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia', // Use the latest API version or match your dependency
});

app.use(cors());
// Use JSON parser for all non-webhook routes
app.use((req, res, next) => {
  if (req.originalUrl === `${API_PREFIX}/webhook`) {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Create a Checkout Session
app.post(`${API_PREFIX}/create-checkout-session`, async (req, res) => {
  const { priceId, userId, successUrl, cancelUrl, mode = 'subscription' } = req.body;

  if (!priceId || !userId) {
    return res.status(400).json({ error: 'Missing priceId or userId' });
  }

  // DEBUG: Create a fresh Stripe instance inside the request to isolate issues
  const key = process.env.STRIPE_SECRET_KEY || '';
  // console.log('--- Request Debug ---');
  // console.log('Using Key:', key.substring(0, 20) + '...');
  const localStripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });

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

    const session = await localStripe.checkout.sessions.create(sessionConfig);

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook handler
app.post(`${API_PREFIX}/webhook`, express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (!endpointSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET is not set');
    }
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('Checkout Session completed:', session);
      // Here you would update the user's subscription status in Supabase
      // e.g., insert into subscriptions table
      break;
    case 'invoice.payment_succeeded':
      const invoice = event.data.object;
      console.log('Invoice payment succeeded:', invoice);
      break;
    case 'customer.subscription.deleted':
      const subscription = event.data.object;
      console.log('Subscription deleted:', subscription);
      // Update user status to free/inactive
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.send();
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
