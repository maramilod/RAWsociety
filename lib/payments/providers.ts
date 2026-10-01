// =====================================================================
// Payment providers
//
// Every way of paying is described here, and nothing else in the site knows the details.
// Today all four are "manual": the client pays outside the site (Sadad, Mobicash, a card
// transfer or a bank transfer), tells us who sent it, from which bank and how much (and may attach
// a photo of the receipt), and an admin checks the company account and confirms it.
//
// To add a new way of paying later (for example Sadad through a real payment gateway):
//   1. add an entry to PROVIDERS below (a new id is enough, the database needs no change),
//   2. change its `mode` to "gateway" and fill in `createCheckout` / `handleWebhook`,
//   3. the payment page and the admin page pick it up automatically.
// =====================================================================

export interface PaymentContext {
  orderNumber: string;
  amount: number;
  currency: string;
}

export interface PaymentProvider {
  /** Stored in payments.method. Lowercase letters, digits and underscores. */
  id: string;
  label: string;
  /** One line shown under the name when the client picks a method. */
  description: string;
  /** Manual methods: must the client say which bank the money was sent from? (Wallets do not need it.) */
  senderBankRequired: boolean;
  /**
   * "manual": the client pays outside the site and an admin confirms it.
   * "gateway": the provider confirms by itself (needs createCheckout and handleWebhook below).
   */
  mode: "manual" | "gateway";
  enabled: boolean;
  /** What the client must do to pay, as short steps. */
  instructions(ctx: PaymentContext): string[];

  // ---- For a future gateway provider (not used by the manual ones) ----
  // createCheckout?(ctx: PaymentContext): Promise<{ redirectUrl: string; providerRef: string }>;
  // handleWebhook?(request: Request): Promise<{ providerRef: string; paid: boolean } | null>;
}

const env = (name: string) => (process.env[name] ?? "").trim();

// Placeholder account details shown until the real ones are set in .env (PAYMENT_*). Replace before going live.
const DEMO: Record<string, string> = {
  PAYMENT_SADAD_NUMBER: "091 000 0000",
  PAYMENT_SADAD_NAME: "RAW society",
  PAYMENT_MOBICASH_NUMBER: "092 000 0000",
  PAYMENT_MOBICASH_NAME: "RAW society",
  PAYMENT_CARD_NUMBER: "0000 0000 0000 0000",
  PAYMENT_CARD_HOLDER: "RAW society",
  PAYMENT_BANK_NAME: "Demo Bank",
  PAYMENT_BANK_ACCOUNT_NAME: "RAW society",
  PAYMENT_BANK_ACCOUNT_NUMBER: "LY00 0000 0000 0000 0000 0000 0",
};
const account = (name: string) => env(name) || DEMO[name] || "";

function money(ctx: PaymentContext) {
  return `${ctx.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${ctx.currency}`;
}

/**
 * Steps shared by every manual provider: where to send the money, the exact amount, the order number
 * as a reference, then "tell us about it" so the admin can find the transfer in the company account.
 */
function manualSteps(ctx: PaymentContext, accountLines: string[]): string[] {
  return [
    ...(accountLines.length
      ? [`Send the money to the RAW society account:`, ...accountLines]
      : ["The account details are not set up yet. Please contact support before paying."]),
    `Send exactly ${money(ctx)}.`,
    `If the app lets you write a note, write ${ctx.orderNumber}.`,
    "Keep the receipt of the transfer.",
    "Then fill in the form below: your name, your bank and the amount you sent. Attach a photo of the receipt if you can. We check our account and confirm, usually within 24 hours.",
  ];
}

const line = (label: string, value: string) => (value ? [`${label}: ${value}`] : []);

const PROVIDERS: PaymentProvider[] = [
  {
    id: "sadad",
    label: "Sadad (Almadar)",
    description: "Pay from your Sadad wallet.",
    senderBankRequired: false,
    mode: "manual",
    enabled: true,
    instructions: (ctx) =>
      manualSteps(ctx, [...line("Sadad number", account("PAYMENT_SADAD_NUMBER")), ...line("Account name", account("PAYMENT_SADAD_NAME"))]),
  },
  {
    id: "mobicash",
    label: "Mobicash",
    description: "Pay from your Mobicash wallet.",
    senderBankRequired: false,
    mode: "manual",
    enabled: true,
    instructions: (ctx) =>
      manualSteps(ctx, [...line("Mobicash number", account("PAYMENT_MOBICASH_NUMBER")), ...line("Account name", account("PAYMENT_MOBICASH_NAME"))]),
  },
  {
    id: "local_bank_card",
    label: "Local bank card",
    description: "Transfer from your bank card.",
    senderBankRequired: true,
    mode: "manual",
    enabled: true,
    instructions: (ctx) =>
      manualSteps(ctx, [...line("Card number", account("PAYMENT_CARD_NUMBER")), ...line("Card holder", account("PAYMENT_CARD_HOLDER"))]),
  },
  {
    id: "bank_transfer",
    label: "Bank transfer",
    description: "Transfer from your bank account.",
    senderBankRequired: true,
    mode: "manual",
    enabled: true,
    instructions: (ctx) =>
      manualSteps(ctx, [
        ...line("Bank", account("PAYMENT_BANK_NAME")),
        ...line("Account name", account("PAYMENT_BANK_ACCOUNT_NAME")),
        ...line("Account number / IBAN", account("PAYMENT_BANK_ACCOUNT_NUMBER")),
      ]),
  },
];

/** Providers that can be used right now. PAYMENT_METHODS_ENABLED=sadad,bank_transfer limits the list. */
export function enabledProviders(): PaymentProvider[] {
  const only = account("PAYMENT_METHODS_ENABLED")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return PROVIDERS.filter((p) => p.enabled && (only.length === 0 || only.includes(p.id)));
}

export function getProvider(id: string): PaymentProvider | null {
  return enabledProviders().find((p) => p.id === id) ?? null;
}

/** A readable name for any method id, even one that is switched off now (used in the admin page). */
export function providerLabel(id: string): string {
  return PROVIDERS.find((p) => p.id === id)?.label ?? id;
}
