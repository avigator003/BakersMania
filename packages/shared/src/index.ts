export const bakeryRoles = [
  "OWNER",
  "MANAGER",
  "ACCOUNTANT",
  "LABOURER",
  "DELIVERY_STAFF",
  "CASHIER"
] as const;

export type BakeryRole = (typeof bakeryRoles)[number];

export const orderSources = [
  "CUSTOMER_PORTAL",
  "WHATSAPP",
  "PHONE",
  "WALK_IN",
  "STAFF_CREATED"
] as const;

export type OrderSource = (typeof orderSources)[number];

export const subscriptionStatuses = [
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "CANCELED",
  "SUSPENDED"
] as const;

export type SubscriptionStatus = (typeof subscriptionStatuses)[number];

export const roleLabels: Record<BakeryRole, string> = {
  OWNER: "Bakery Owner",
  MANAGER: "Manager",
  ACCOUNTANT: "Accountant",
  LABOURER: "Labourer",
  DELIVERY_STAFF: "Delivery / Route Staff",
  CASHIER: "Cashier / Sales Staff"
};
