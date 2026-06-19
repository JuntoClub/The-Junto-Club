import Stripe from "stripe";
import type { Config, Context } from "@netlify/functions";

declare const Netlify: {
  env: {
    get(name: string): string | undefined;
  };
};

type ProductKey = keyof ReturnType<typeof getProducts>;

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const stripeSecretKey = Netlify.env.get("STRIPE_SECRET_KEY");
  const stripe = stripeSecretKey
    ? new Stripe(stripeSecretKey, {
        apiVersion: "2026-02-25.clover",
      })
    : null;

  if (!stripe) {
    return json({ error: "Stripe is not configured." }, 500);
  }

  const products = getProducts();

  let product: ProductKey;

  try {
    const body = await req.json() as { product?: string };

    if (!isProductKey(body.product)) {
      return json({ error: "Unknown checkout product." }, 400);
    }

    product = body.product;
  } catch {
    return json({ error: "Invalid checkout request." }, 400);
  }

  const item = products[product];

  if (!item?.priceId) {
    return json({ error: "This product is not configured for checkout." }, 400);
  }

  const origin = new URL(req.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price: item.priceId,
        quantity: item.quantity,
      },
    ],
    billing_address_collection: "required",
    shipping_address_collection: {
      allowed_countries: ["US"],
    },
    phone_number_collection: {
      enabled: true,
    },
    success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?checkout=cancelled`,
  });

  return json({ url: session.url });
};

export const config: Config = {
  path: "/api/create-checkout-session",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function isProductKey(product: string | undefined): product is ProductKey {
  return Boolean(product && product in getProducts());
}

function getProducts() {
  return {
    "chase-pack": {
      priceId: Netlify.env.get("STRIPE_CHASE_PRICE_ID"),
      quantity: 1,
    },
    numismatics: {
      priceId: Netlify.env.get("STRIPE_NUMISMATICS_PRICE_ID"),
      quantity: 1,
    },
  };
}
