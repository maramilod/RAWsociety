// The ways a creator can ask to be paid, and how each one is checked.
// Plain code only, so the form in the browser and the server use the same rules.

export type PayoutMethodId = "bank_transfer" | "sadad" | "mobicash" | "local_bank_card";

export interface PayoutMethod {
  id: PayoutMethodId;
  label: string;
  description: string;
  /** Label and hint of the main number */
  numberLabel: string;
  numberHint: string;
  /** Does this way need the name of a bank? */
  bank: boolean;
  /** Label for the name on the account */
  nameLabel: string;
}

export const PAYOUT_METHODS: PayoutMethod[] = [
  {
    id: "bank_transfer",
    label: "Bank transfer",
    description: "Money goes to your bank account.",
    numberLabel: "Account number / IBAN",
    numberHint: "e.g. LY83 002 048 0000 0000 0000 1",
    bank: true,
    nameLabel: "Account holder name",
  },
  {
    id: "sadad",
    label: "Sadad (Almadar)",
    description: "Money goes to your Sadad wallet.",
    numberLabel: "Sadad phone number",
    numberHint: "e.g. 091 234 5678",
    bank: false,
    nameLabel: "Name on the wallet",
  },
  {
    id: "mobicash",
    label: "Mobicash",
    description: "Money goes to your Mobicash wallet.",
    numberLabel: "Mobicash phone number",
    numberHint: "e.g. 092 234 5678",
    bank: false,
    nameLabel: "Name on the wallet",
  },
  {
    id: "local_bank_card",
    label: "Local bank card",
    description: "Money goes to your bank card.",
    numberLabel: "Card number",
    numberHint: "16 digits",
    bank: true,
    nameLabel: "Card holder name",
  },
];

export const payoutMethod = (id: string) => PAYOUT_METHODS.find((m) => m.id === id);

export interface PayoutInput {
  method: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
}

export interface CleanPayout {
  method: PayoutMethodId;
  accountName: string;
  accountNumber: string;
  bankName: string | null;
}

/** Checks what the creator typed. Returns the cleaned values, or a message that says what to fix. */
export function cleanPayout(input: PayoutInput): CleanPayout | { error: string } {
  const method = payoutMethod(String(input.method ?? ""));
  if (!method) return { error: "Please choose how you want to be paid." };

  const accountName = String(input.accountName ?? "").replace(/\s+/g, " ").trim();
  if (accountName.length < 3 || accountName.length > 120) return { error: `Please enter the ${method.nameLabel.toLowerCase()} (at least 3 characters).` };

  const raw = String(input.accountNumber ?? "").trim();
  let accountNumber: string;
  if (method.id === "sadad" || method.id === "mobicash") {
    accountNumber = raw.replace(/[\s-]/g, "");
    if (!/^\+?\d{9,15}$/.test(accountNumber)) return { error: `Please enter a valid ${method.numberLabel.toLowerCase()} (9 to 15 digits).` };
  } else if (method.id === "local_bank_card") {
    accountNumber = raw.replace(/[\s-]/g, "");
    if (!/^\d{12,19}$/.test(accountNumber)) return { error: "Please enter the card number (12 to 19 digits)." };
  } else {
    accountNumber = raw.replace(/\s+/g, " ").toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9 -]{5,39}$/.test(accountNumber)) return { error: "Please enter the account number or IBAN (6 to 40 letters and digits)." };
  }

  let bankName: string | null = null;
  if (method.bank) {
    bankName = String(input.bankName ?? "").replace(/\s+/g, " ").trim();
    if (bankName.length < 2 || bankName.length > 120) return { error: "Please enter the name of the bank." };
  }

  return { method: method.id, accountName, accountNumber, bankName };
}

/** Shows only the end of a number, for places that do not need all of it */
export const maskNumber = (n: string) => (n.length <= 4 ? n : `${"•".repeat(Math.min(8, n.length - 4))}${n.slice(-4)}`);
