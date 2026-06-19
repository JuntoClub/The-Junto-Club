# The Junto Club — Artwork-Based Website

This version uses the approved mockup artwork as the visual page design. It does not recreate the newspaper with clean HTML cards.

Upload the contents of this ZIP to the root of the GitHub repo:

- index.html
- style.css
- thank-you.html
- assets/

Delete all old files first so there is only one stylesheet and one index file.

Clickable/functional areas are layered invisibly over the artwork.

## Stripe checkout

The Chase Buy Packs hotspots use Stripe Checkout through a Netlify Function, so the Stripe secret key is never exposed in browser code.

Set these Netlify environment variables before going live:

- `STRIPE_SECRET_KEY` — your Stripe secret key
- `STRIPE_CHASE_PRICE_ID` — the Stripe Price ID for The Chase pack

Apple Pay is supported through Stripe Checkout. To make it appear, enable Apple Pay/payment wallets in Stripe, verify the live domain `thechase.info` in Stripe's payment method domain settings, and make sure the site is served over HTTPS.
