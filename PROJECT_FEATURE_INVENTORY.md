# BakersMania CRM Feature Inventory

## 1. Product overview
BakersMania is being redefined as a generic, scalable CRM and operations platform for bakeries and other food businesses. The product will be designed to support multiple tenants, each with its own workspace, workflows, and subscription plan.

## 2. Product scope
### Core business domain
- customer management and lead tracking
- order and quotation workflows
- catalog and pricing management
- inventory and stock control
- purchasing and supplier management
- invoicing and payments
- staff roles and approvals
- dashboards and business reporting
- subscription billing and plan management

## 3. Platform modules
### 3.0 Bakery operations foundation
These are the original bakery-specific capabilities that should remain as part of the product’s core feature set, but be generalized so they can work for many food businesses.

Features:
- order creation with pricing rules and payment tracking
- route-based or delivery-based sales workflows
- stock updates triggered by completed orders
- raw material purchase and consumption tracking
- labour attendance, payroll, and salary history
- expense, rent, supplier, and vehicle management
- invoice generation and export reports for dispatch planning

### 3.1 Tenant and account management
Features:
- tenant signup and onboarding
- workspace configuration
- subdomain or custom domain support
- billing account and owner management

### 3.2 Authentication and permissions
Features:
- secure login and password reset
- role-based access control
- team member invitations
- audit trail for important actions

### 3.3 Customer CRM
Features:
- customer profiles and contact history
- lead status tracking
- tags and segmentation
- notes and follow-up reminders
- order and payment history per customer

### 3.4 Product and pricing management
Features:
- product catalog with categories and variants
- price books and discounts
- tax configuration
- product availability and status

### 3.5 Orders and invoices
Features:
- quotation creation
- order placement and tracking
- invoice generation
- payment status tracking
- invoice export and PDF delivery

### 3.6 Inventory and production
Features:
- stock levels and alerts
- stock adjustment history
- purchase orders and supplier records
- production planning and batch tracking

### 3.7 Finance and operations
Features:
- expenses and bills
- supplier records
- payroll and attendance concepts for staff
- basic reporting for profitability and activity

### 3.8 Reporting and analytics
Features:
- sales overview dashboard
- order trends and customer insights
- inventory health reports
- exportable reports for owners and managers

### 3.9 Subscription and billing
Features:
- plan selection and upgrade paths
- recurring billing via Stripe
- trial periods and usage limits
- billing history and invoice management

## 4. Non-functional requirements
- multi-tenant architecture by design
- secure and scalable APIs
- configurable workflow rules per tenant
- mobile-friendly responsive UI
- observability, logging, and error tracking
- strong data privacy and tenant isolation

## 5. MVP priorities
The initial release should focus on the core workflows that are needed to validate the product and start subscriptions:
- tenant onboarding
- authentication and role access
- customer records
- product catalog and pricing
- order and invoice management
- basic inventory tracking
- dashboards and reports
- subscription billing


