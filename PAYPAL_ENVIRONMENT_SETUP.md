# Q PayPal Sandbox and Live Setup

This guide configures Q Plus so sandbox and live PayPal credentials can coexist.
The intended final behaviour is that `PAYPAL_ENV` is the only variable changed
when selecting the active PayPal environment.

> Do not put PayPal client secrets in source code, Git, browser-visible `VITE_*`
> variables, screenshots, support messages, or test output.

## Before you begin

You need:

- access to the PayPal Developer Dashboard;
- a PayPal Sandbox business account;
- access to the Q project in Vercel;
- access to the Q repository settings in GitHub; and
- the normal monthly and yearly Q Plus prices.

The confirmed live plan IDs are:

```text
Regular monthly:       P-9BF15414KR263243PNKJI4RQ
Founding 100 monthly:  P-90E70477TR301832GNKJI4RQ
Regular yearly:        P-1UA22198X6483143BNKJI4QI
Founding 100 yearly:   P-53M494159D470672HNKJI4QQ
```

Do not use the older `Q-AI Plus` plans unless they are deliberately brought
back into the current product catalogue.

## Step 1: Open the PayPal Sandbox business account

1. Open <https://developer.paypal.com/dashboard/>.
2. Select **Testing Tools** and then **Sandbox Accounts**.
3. Select the Sandbox **Business** account used by Q.
4. Open its account details and locate its sign-in credentials.
5. Sign in to the PayPal Sandbox business interface.
6. Confirm that the interface says **Sandbox**, not **Live**.

Stop if you cannot confirm that you are in Sandbox.

## Step 2: Open or create the Q Plus product

1. Open PayPal's subscriptions or products area.
2. Find the product named **Q Plus**.
3. If it already exists, open it and reuse it.
4. If it does not exist, create it with:

```text
Product name: Q Plus
Product type: Service
Description: Q Plus Membership
```

All four Sandbox plans in this guide should belong to this one Q Plus product.

## Step 3: Create the regular monthly plan

Create a plan under **Q Plus** with:

```text
Plan name: Q Plus Monthly
Currency: GBP
Setup fee: No
Trial period: No
Subscription price: £9.99
Frequency: Every 1 month
Billing cycles: Unlimited
Missed cycles before suspension: 3
Auto billing of outstanding payments: On
```

Review the plan, turn it on, and copy its `P-...` ID here:

```text
PAYPAL_SANDBOX_PLAN_ID_MONTHLY=
```

## Step 4: Create the Founding 100 monthly plan

Create another plan under **Q Plus** with:

```text
Plan name: Q Plus Monthly — Founding 100
Currency: GBP
Setup fee: No
Trial period: Yes
Trial price: £5.00
Trial frequency: Every 1 month
Trial cycles: 3
Regular subscription price: £9.99
Regular frequency: Every 1 month
Regular billing cycles: Unlimited
Missed cycles before suspension: 3
Auto billing of outstanding payments: On
```

The review must say that the first three monthly payments are £5.00 and later
monthly payments are £9.99 until cancellation.

Turn the plan on and copy its ID here:

```text
PAYPAL_SANDBOX_FOUNDER_PLAN_ID_MONTHLY=
```

PayPal does not enforce the first-100-customer limit. Q is responsible for
checking eligibility before selecting this plan.

## Step 5: Create the regular yearly plan

Create another plan under **Q Plus** with:

```text
Plan name: Q Plus Yearly
Currency: GBP
Setup fee: No
Trial period: No
Subscription price: YOUR FULL YEARLY PRICE
Frequency: Every 1 year
Billing cycles: Unlimited
Missed cycles before suspension: 3
Auto billing of outstanding payments: On
```

Turn the plan on and copy its ID here:

```text
PAYPAL_SANDBOX_PLAN_ID_YEARLY=
```

## Step 6: Create the Founding 100 yearly plan

Calculate 50% of the full yearly price and round it to two decimal places.

Create another plan under **Q Plus** with:

```text
Plan name: Q Plus Yearly — Founding 100
Currency: GBP
Setup fee: No
Trial period: Yes
Trial price: 50% OF THE FULL YEARLY PRICE
Trial frequency: Every 1 year
Trial cycles: 1
Regular subscription price: YOUR FULL YEARLY PRICE
Regular frequency: Every 1 year
Regular billing cycles: Unlimited
Missed cycles before suspension: 3
Auto billing of outstanding payments: On
```

The review must show one discounted yearly payment followed by the full yearly
price every year until cancellation.

Turn the plan on and copy its ID here:

```text
PAYPAL_SANDBOX_FOUNDER_PLAN_ID_YEARLY=
```

## Step 7: Create or confirm the Sandbox REST application

1. Return to the PayPal Developer Dashboard.
2. Open **Apps & Credentials**.
3. Select **Sandbox**.
4. Create or open the REST application used by Q.
5. Copy its Client ID.
6. Reveal and securely copy its Client Secret.
7. Do not paste the Client Secret into this document.

You will configure these names in Vercel:

```text
PAYPAL_SANDBOX_CLIENT_ID
PAYPAL_SANDBOX_CLIENT_SECRET
```

## Step 8: Create or confirm the Sandbox webhook

1. In the same Sandbox REST application, open **Webhooks**.
2. Add the public HTTPS endpoint for the Q test or preview deployment:

```text
https://YOUR-TEST-HOST/api/billing/paypal/webhook
```

3. Select the billing subscription and completed/refunded/reversed payment
   events required by Q.
4. Save the webhook.
5. Copy its webhook ID for `PAYPAL_SANDBOX_WEBHOOK_ID`.

Never point a Sandbox webhook at a deployment configured with
`PAYPAL_ENV=live`.

## Step 9: Add both credential groups to Vercel

Open **Vercel → Q project → Settings → Environment Variables**.

Add the Sandbox group to Preview and Development:

```text
PAYPAL_SANDBOX_CLIENT_ID=
PAYPAL_SANDBOX_CLIENT_SECRET=
PAYPAL_SANDBOX_PLAN_ID_MONTHLY=
PAYPAL_SANDBOX_FOUNDER_PLAN_ID_MONTHLY=
PAYPAL_SANDBOX_PLAN_ID_YEARLY=
PAYPAL_SANDBOX_FOUNDER_PLAN_ID_YEARLY=
PAYPAL_SANDBOX_WEBHOOK_ID=
```

Add the Live group to Production:

```text
PAYPAL_LIVE_CLIENT_ID=
PAYPAL_LIVE_CLIENT_SECRET=
PAYPAL_LIVE_PLAN_ID_MONTHLY=P-9BF15414KR263243PNKJI4RQ
PAYPAL_LIVE_FOUNDER_PLAN_ID_MONTHLY=P-90E70477TR301832GNKJI4RQ
PAYPAL_LIVE_PLAN_ID_YEARLY=P-1UA22198X6483143BNKJI4QI
PAYPAL_LIVE_FOUNDER_PLAN_ID_YEARLY=P-53M494159D470672HNKJI4QQ
PAYPAL_LIVE_WEBHOOK_ID=
```

Set the selector separately:

```text
Preview and Development: PAYPAL_ENV=sandbox
Production:              PAYPAL_ENV=live
```

Do not prefix any PayPal variable with `VITE_`.

## Step 10: Add Sandbox-only GitHub Actions secrets

Open **GitHub → Q repository → Settings → Secrets and variables → Actions**.

Create these repository secrets:

```text
TEST_PAYPAL_ENV                         sandbox
TEST_PAYPAL_SANDBOX_CLIENT_ID           Sandbox REST app Client ID
TEST_PAYPAL_SANDBOX_CLIENT_SECRET       Sandbox REST app Client Secret
TEST_PAYPAL_SANDBOX_PLAN_ID_MONTHLY     Regular Sandbox monthly plan ID
TEST_PAYPAL_SANDBOX_PLAN_ID_YEARLY      Regular Sandbox yearly plan ID
TEST_PAYPAL_SANDBOX_WEBHOOK_ID          Sandbox webhook ID
```

Do not add live PayPal credentials to the nightly test workflow.

The Founding 100 GitHub secret names will be added when the remaining checkout
implementation is completed:

```text
TEST_PAYPAL_SANDBOX_FOUNDER_PLAN_ID_MONTHLY
TEST_PAYPAL_SANDBOX_FOUNDER_PLAN_ID_YEARLY
```

## Step 11: Complete the remaining Q implementation

The regular monthly and yearly plans already switch through `PAYPAL_ENV`.
Founding 100 checkout still reads the single
`crm_products.paypal_founder_plan_id` value from Supabase.

Before relying on one-variable environment switching, Q must be updated to read:

```text
PAYPAL_SANDBOX_FOUNDER_PLAN_ID_MONTHLY
PAYPAL_SANDBOX_FOUNDER_PLAN_ID_YEARLY
PAYPAL_LIVE_FOUNDER_PLAN_ID_MONTHLY
PAYPAL_LIVE_FOUNDER_PLAN_ID_YEARLY
```

Do not enable Sandbox Founding 100 checkout until this change has been
implemented and validated.

## Step 12: Redeploy and verify Sandbox

1. Redeploy the Vercel Preview environment after saving its variables.
2. Confirm Preview has `PAYPAL_ENV=sandbox`.
3. Sign in with a dedicated test customer.
4. Start regular monthly checkout and confirm the PayPal approval page is
   Sandbox and shows £9.99 monthly.
5. Start regular yearly checkout and confirm the full yearly price.
6. After Step 11 is implemented, use a new eligible customer to verify the
   Founding 100 monthly offer.
7. Verify another eligible customer receives the Founding 100 yearly offer.
8. Confirm later/non-eligible customers receive regular plans.
9. Complete a Sandbox payment and confirm the subscription is recorded in Q.
10. Confirm the webhook is accepted and duplicate webhook delivery is safe.

## Step 13: Verify before using Live

Before changing or redeploying Production, confirm:

- all four Live plan IDs match the live Q Plus product;
- all four Sandbox plan IDs match the sandbox Q Plus product;
- every plan is active;
- Sandbox and Live client credentials are not mixed;
- each webhook belongs to the matching REST application and environment;
- Preview checkout opens Sandbox PayPal;
- Production retains `PAYPAL_ENV=live`; and
- the Founding 100 environment-selection implementation is complete.

Changing only `PAYPAL_ENV` is safe only after both credential groups are
complete and Step 11 has been implemented.
