# Modulo de Pagos SaaS Multi-Tenant

## Objetivo

Disenar e implementar un modulo de pagos para una plataforma SaaS multi-tenant de gestion de canchas y ecommerce, con estas reglas:

- El owner de la plataforma cobra la mensualidad del SaaS.
- Cada owner de complejo cobra sus propias reservas y ventas.
- El usuario comun solo paga; no configura cuentas receptoras.
- Mercado Pago se usa solo como gateway de cobro y reembolso.
- No se usan suscripciones automaticas de Mercado Pago.

## Estado actual del repo

Hoy el proyecto ya tiene una base parcial:

- Facturacion mensual owner implementada en `backend/src/utils/ownerBilling.js`.
- Modelo de mensualidad owner en `backend/src/models/OwnerBilling.js`.
- Bloqueo funcional del panel owner si no paga.
- Panel owner de facturacion y panel superadmin de seguimiento basico.

Limitaciones actuales:

- Solo existe el flujo de mensualidad del SaaS.
- Reservas y pedidos todavia no tienen un flujo real de cobro Mercado Pago por complejo.
- No existe conexion segura por owner de complejo con su propia cuenta de Mercado Pago.
- No existe motor de reembolsos ni un ledger unificado de transacciones.

La recomendacion es evolucionar desde `owner-billing` a un modulo de pagos mas general, sin romper el flujo mensual ya existente.

## Principios de arquitectura

### 1. Separar contextos de pago

No mezclar en un mismo modelo la mensualidad SaaS con reservas y ecommerce.

Contextos:

- `SaaS Billing`: mensualidad que paga el owner de complejo al owner del SaaS.
- `Booking Payments`: cobros por reservas de canchas.
- `Order Payments`: cobros por productos del ecommerce.
- `Refunds`: devoluciones parciales o totales.
- `Payment Accounts`: credenciales y cuentas receptoras por tenant.
- `Payment Transactions`: trazabilidad unificada de eventos y estados.

### 2. Mercado Pago como pasarela, no como core de negocio

La logica de facturacion, vencimiento, gracia, bloqueo, reembolsos y habilitacion vive en tu backend.

Mercado Pago solo debe encargarse de:

- generar preferencias
- procesar cobros
- devolver estados
- ejecutar reembolsos
- disparar webhooks

### 3. Cuenta cobradora segun el flujo

- Mensualidad SaaS: cobra la cuenta del owner de la plataforma.
- Reserva: cobra la cuenta del owner del complejo.
- Ecommerce: cobra la cuenta del owner del complejo.

No debe existir una cuenta global unica para todos los cobros del marketplace si el producto requiere que cada complejo cobre por su cuenta.

## Roles y permisos

## Owner de la plataforma

Puede:

- configurar la cuenta Mercado Pago que cobra la mensualidad SaaS
- crear y editar planes
- generar cargos mensuales
- ver complejos morosos
- aprobar y ejecutar reembolsos de mensualidad
- auditar todas las transacciones, reservas, pedidos y reembolsos

No debe:

- cobrar las reservas o ventas de los complejos

## Dueño de complejo

Puede:

- conectar su propia cuenta Mercado Pago para reservas y ecommerce
- ver cobros recibidos de reservas
- ver cobros recibidos de pedidos
- pedir o ejecutar reembolsos segun reglas y permisos
- pagar la mensualidad del SaaS

No debe:

- ver pagos de otros complejos
- administrar planes globales del SaaS

## Usuario comun

Puede:

- pagar reservas
- pagar productos
- ver historial propio
- solicitar reembolsos cuando corresponda

No puede:

- configurar cuentas Mercado Pago
- ver cobros de terceros
- recibir dinero

## Arquitectura recomendada

## Backend

Capas:

- `routes`: endpoints HTTP
- `controllers`: validacion de request y respuestas
- `services/payments`: logica de negocio por dominio
- `providers/mercadopago`: adaptador hacia API Mercado Pago
- `workers`: generacion de cargos mensuales y reintentos
- `webhooks`: recepcion, verificacion, idempotencia y procesamiento

Bounded contexts:

- `payment-accounts`
- `subscription-plans`
- `monthly-charges`
- `booking-payments`
- `order-payments`
- `refunds`
- `payment-transactions`
- `payment-webhooks`

## Frontend

React separado por rol:

- `superadmin/payments`
- `owner/payments`
- `owner/payment-settings`
- `client/payment-history`
- `checkout/booking`
- `checkout/order`

## MongoDB

Separar entidades por responsabilidad. Evitar seguir agregando campos de pago dentro de `Reservation` y `Order` como solucion final.

## Integracion con Mercado Pago

### Recomendacion principal para cuentas receptoras

Para owners de complejos y para el owner del SaaS, la opcion profesional es:

- usar OAuth de Mercado Pago para conectar cuentas
- guardar `access_token`, `refresh_token`, `user_id` y expiracion
- cifrar esos tokens en base de datos

No recomendar guardar tokens pegados manualmente en texto plano.

Si queres permitir modo manual durante desarrollo:

- habilitar un modo `manual_credentials`
- cifrar igual
- dejarlo desactivado por defecto en produccion

### Cuenta usada por cada cobro

- `MonthlyCharge`: usa el `PaymentAccount` del owner de la plataforma
- `BookingPayment`: usa el `PaymentAccount` del owner del complejo
- `OrderPayment`: usa el `PaymentAccount` del owner del complejo

### Credenciales globales en .env

Estas variables quedan a nivel plataforma:

```env
APP_URL=http://localhost:5173
BACKEND_URL=http://localhost:3200

MERCADOPAGO_CLIENT_ID=
MERCADOPAGO_CLIENT_SECRET=
MERCADOPAGO_PUBLIC_KEY=
MERCADOPAGO_WEBHOOK_SECRET=

PAYMENT_CREDENTIALS_ENCRYPTION_KEY=
PAYMENT_CREDENTIALS_ENCRYPTION_IV=

OWNER_BILLING_DEFAULT_PLAN_CODE=basic-monthly
OWNER_PAYMENT_GRACE_DAYS=10
OWNER_BILLING_CYCLE_MONTHS=1

PAYMENTS_ENABLE_MANUAL_MP_CREDENTIALS=false
PAYMENTS_REFUND_WINDOW_HOURS=48
```

Notas:

- `MERCADOPAGO_CLIENT_ID` y `MERCADOPAGO_CLIENT_SECRET` sirven para OAuth.
- `MERCADOPAGO_PUBLIC_KEY` sirve para el frontend checkout si usas Bricks.
- `MERCADOPAGO_WEBHOOK_SECRET` se usa para validar `x-signature`.
- `PAYMENT_CREDENTIALS_ENCRYPTION_KEY` debe ser obligatoria en produccion.

## Almacenamiento seguro de credenciales

Entidad sugerida: `PaymentAccount`

Campos principales:

- `_id`
- `ownerType`: `platform_owner | complex_owner`
- `ownerUserId`
- `complexId` nullable
- `provider`: `mercadopago`
- `mode`: `oauth | manual_credentials`
- `status`: `PENDING | ACTIVE | INVALID | REVOKED`
- `mpUserId`
- `encryptedAccessToken`
- `encryptedRefreshToken`
- `tokenExpiresAt`
- `publicKey`
- `collectorId`
- `lastValidatedAt`
- `lastValidationError`
- `metadata`
- `createdAt`
- `updatedAt`

Buenas practicas:

- cifrado AES-256-GCM o equivalente
- no devolver tokens al frontend
- auditar cambios de credenciales
- revalidar la cuenta conectada al guardarla

## Modelos de datos sugeridos

## `SubscriptionPlan`

- `code`
- `name`
- `description`
- `amount`
- `currency`
- `billingCycleMonths`
- `graceDays`
- `features`
- `isActive`
- `createdBy`

## `MonthlyCharge`

Reemplaza conceptualmente al actual `OwnerBilling`, o puede convivir durante migracion.

- `ownerId`
- `complexId`
- `planId`
- `periodStart`
- `periodEnd`
- `dueDate`
- `paidAt`
- `amount`
- `currency`
- `status`: `PENDING | APPROVED | REJECTED | CANCELLED | REFUNDED | EXPIRED`
- `graceEndsAt`
- `blockAt`
- `paymentTransactionId`
- `notes`
- `generatedBy`

## `BookingPayment`

- `reservationId`
- `complexId`
- `ownerId`
- `payerUserId`
- `paymentAccountId`
- `amount`
- `currency`
- `status`: `PENDING | APPROVED | REJECTED | CANCELLED | REFUNDED | PARTIALLY_REFUNDED`
- `paidAt`
- `mpPreferenceId`
- `mpPaymentId`
- `paymentTransactionId`

## `OrderPayment`

- `orderId`
- `complexId`
- `ownerId`
- `payerUserId`
- `paymentAccountId`
- `amount`
- `currency`
- `status`
- `paidAt`
- `mpPreferenceId`
- `mpPaymentId`
- `paymentTransactionId`

## `Refund`

- `scope`: `MONTHLY_CHARGE | BOOKING_PAYMENT | ORDER_PAYMENT`
- `targetId`
- `complexId` nullable
- `requestedBy`
- `approvedBy`
- `executedBy`
- `reason`
- `policyReason`
- `amountRequested`
- `amountApproved`
- `currency`
- `type`: `FULL | PARTIAL`
- `status`: `REQUESTED | APPROVED | REJECTED | PROCESSING | COMPLETED | FAILED`
- `mpRefundId`
- `requestedAt`
- `approvedAt`
- `completedAt`

## `PaymentTransaction`

Ledger tecnico y funcional.

- `scope`: `MONTHLY_CHARGE | BOOKING_PAYMENT | ORDER_PAYMENT | REFUND`
- `scopeId`
- `provider`: `mercadopago`
- `paymentAccountId`
- `externalReference`
- `idempotencyKey`
- `preferenceId`
- `paymentId`
- `merchantOrderId`
- `status`: `CREATED | PENDING | APPROVED | REJECTED | CANCELLED | REFUNDED | CHARGEBACK`
- `statusDetail`
- `amount`
- `currency`
- `payer`
- `collector`
- `rawProviderPayload`
- `processedAt`

## `WebhookEvent`

- `provider`
- `topic`
- `externalEventId`
- `signatureValid`
- `payload`
- `headers`
- `status`: `RECEIVED | PROCESSED | FAILED | IGNORED`
- `processedAt`
- `error`

## Flujos funcionales

## A. Pago de mensualidad del SaaS

### Flujo

1. Un job mensual genera `MonthlyCharge` para cada complejo aprobado.
2. El sistema calcula:
   - periodo
   - monto
   - vencimiento
   - fin de gracia
3. Se crea una preferencia Mercado Pago usando la cuenta del owner del SaaS.
4. El owner del complejo paga.
5. Llega webhook.
6. Se actualizan `PaymentTransaction` y `MonthlyCharge`.
7. Si queda impago y vence la gracia:
   - se bloquea el dashboard owner
   - el complejo deja de aceptar reservas y compras

### Reglas de negocio

- No usar suscripcion automatica.
- Cada cargo mensual es una entidad propia.
- Se pueden regenerar links de pago si vencen.
- Se puede cambiar de plan para el siguiente ciclo, no necesariamente el actual.

### Estados

- `PENDING`
- `APPROVED`
- `REJECTED`
- `CANCELLED`
- `EXPIRED`
- `REFUNDED`

## B. Pago de reservas

### Flujo

1. El cliente crea una reserva provisional.
2. Se crea `BookingPayment`.
3. Se genera preferencia con el `PaymentAccount` del owner del complejo.
4. El cliente paga.
5. Webhook confirma el pago.
6. Se marca la reserva como:
   - `CONFIRMED` si la politica es confirmacion automatica
   - `PENDING_CONFIRMATION` si queres doble validacion

### Reglas

- El dinero nunca va a la cuenta del owner del SaaS.
- Si el complejo no tiene cuenta Mercado Pago activa, no se puede abrir checkout.
- Si el owner esta bloqueado por mensualidad impaga, no se permite cobrar reservas.

## C. Pago de productos

### Flujo

1. El cliente arma carrito.
2. Se crea `Order` y `OrderPayment`.
3. Se reserva stock temporalmente.
4. Se genera preferencia con la cuenta del owner del complejo.
5. Webhook aprueba o rechaza.
6. Si aprueba:
   - descontar stock definitivo
   - marcar pedido `PAID`
7. Si falla o expira:
   - liberar reserva de stock

## Sistema de reembolsos

## Reembolsos de reservas

Casos:

- cancelacion por usuario
- cancelacion por owner del complejo
- cancha no disponible
- reprogramacion fallida

Politicas sugeridas:

- mas de 48h: reembolso total
- entre 24h y 48h: reembolso parcial configurable
- menos de 24h: sin reembolso o solo excepcion manual

## Reembolsos de productos

Casos:

- falta de stock
- cobro duplicado
- producto defectuoso
- cancelacion antes de entrega

## Reembolsos de mensualidad

Casos especiales:

- doble cobro
- activacion erronea
- compensacion comercial

Solo los aprueba el owner del SaaS.

## Lógica operativa de refund

1. Se crea `Refund` con estado `REQUESTED`
2. Segun scope y rol:
   - owner del complejo puede solicitar o aprobar refund de reservas y pedidos propios
   - owner del SaaS aprueba refund de mensualidad
3. El backend ejecuta refund contra Mercado Pago
4. Se actualiza:
   - `Refund`
   - `PaymentTransaction`
   - `BookingPayment` / `OrderPayment` / `MonthlyCharge`

## Estados de pago y mapeo

Estado interno recomendado:

- `PENDING`
- `APPROVED`
- `REJECTED`
- `CANCELLED`
- `REFUNDED`
- `PARTIALLY_REFUNDED`
- `CHARGEBACK`

No acoplar todo el dominio a los literales exactos del proveedor.

Guardar aparte:

- `providerStatus`
- `providerStatusDetail`

## Endpoints sugeridos

## Payment Accounts

- `POST /api/payment-accounts/connect-url`
- `GET /api/payment-accounts/oauth/callback`
- `GET /api/payment-accounts/me`
- `POST /api/payment-accounts/validate`
- `PATCH /api/payment-accounts/:id/disable`

## Planes SaaS

- `GET /api/subscription-plans`
- `POST /api/subscription-plans`
- `PATCH /api/subscription-plans/:id`

## Cargos mensuales

- `GET /api/monthly-charges`
- `POST /api/monthly-charges/generate`
- `POST /api/monthly-charges/:id/checkout`
- `GET /api/monthly-charges/:id`
- `POST /api/monthly-charges/:id/forgive`
- `POST /api/monthly-charges/:id/refund`

## Pagos de reservas

- `POST /api/booking-payments`
- `GET /api/booking-payments/mine`
- `GET /api/booking-payments/complex`
- `POST /api/booking-payments/:id/checkout`
- `POST /api/booking-payments/:id/refund-request`
- `POST /api/booking-payments/:id/refund`

## Pagos de pedidos

- `POST /api/order-payments`
- `GET /api/order-payments/mine`
- `GET /api/order-payments/complex`
- `POST /api/order-payments/:id/checkout`
- `POST /api/order-payments/:id/refund-request`
- `POST /api/order-payments/:id/refund`

## Reembolsos

- `GET /api/refunds`
- `POST /api/refunds/:id/approve`
- `POST /api/refunds/:id/reject`
- `POST /api/refunds/:id/execute`

## Auditoria / ledger

- `GET /api/payment-transactions`
- `GET /api/payment-transactions/:id`
- `GET /api/payment-metrics/summary`

## Webhooks

- `POST /api/payment-webhooks/mercadopago`

## Logica de webhooks

El webhook debe ser unico y centralizado.

## Proceso

1. Recibir notificacion
2. Guardar `WebhookEvent` en estado `RECEIVED`
3. Validar firma `x-signature`
4. Resolver tema y cuenta dueña de la notificacion
5. Consultar el recurso real en Mercado Pago usando el access token correcto
6. Aplicar idempotencia
7. Actualizar la entidad de negocio correspondiente
8. Actualizar ledger `PaymentTransaction`
9. Marcar `WebhookEvent` como `PROCESSED`

## Seguridad del webhook

Obligatorio:

- validar `x-signature` segun documentacion vigente de Mercado Pago
- usar comparacion constante del hash
- persistir `externalEventId` para no reprocesar
- consultar el payment real en Mercado Pago antes de impactar negocio

No confiar solo en el body recibido por webhook.

## Reglas por dominio al procesar webhooks

### MonthlyCharge

- si `approved`: habilitar acceso
- si `rejected/cancelled`: mantener pendiente o fallido
- si `refunded`: evaluar si vuelve a bloquearse segun politica

### BookingPayment

- si `approved`: confirmar reserva
- si `rejected`: liberar turno provisional
- si `refunded`: cancelar o ajustar reserva segun contexto

### OrderPayment

- si `approved`: confirmar pedido y descontar stock
- si `rejected`: liberar stock reservado
- si `refunded`: revertir pedido segun politica

## Prevencion de fraude y duplicacion

- usar `idempotencyKey` por intento de pago
- usar `externalReference` unico por transaccion
- no permitir mas de una preferencia activa por recurso salvo reintento controlado
- bloquear confirmacion manual si ya existe pago aprobado
- guardar `rawProviderPayload`
- validar importes y moneda antes de aprobar negocio
- reservar stock o slot antes del checkout con expiracion corta

## UX/UI propuesta

## Owner del SaaS

Pantallas:

- `Pagos SaaS`
- `Planes`
- `Morosidad`
- `Reembolsos`
- `Auditoria`

Widgets:

- MRR / cobrado del mes
- complejos en gracia
- complejos bloqueados
- reembolsos pendientes
- comparativa por plan

## Dueño de complejo

Pantallas:

- `Configuracion de cobros`
- `Cobros de reservas`
- `Cobros ecommerce`
- `Reembolsos`
- `Pago del SaaS`

Widgets:

- cuenta Mercado Pago conectada / expirada
- cobros pendientes de acreditacion
- reservas cobradas del dia
- pedidos cobrados del dia
- proximos vencimientos del SaaS

## Usuario comun

Pantallas:

- `Checkout reserva`
- `Checkout pedido`
- `Mis pagos`
- `Mis reembolsos`

Widgets:

- estado de cada pago
- comprobante
- boton de solicitar reembolso si aplica

## Recomendacion de implementacion por fases

## Fase 1

- Consolidar lo existente de `owner-billing`
- Introducir `PaymentAccount`
- Conectar owner del SaaS via OAuth o credencial segura
- Migrar webhook a endpoint central

## Fase 2

- Cobro real de reservas con Mercado Pago por owner de complejo
- Confirmacion via webhook
- Reserva provisional de turnos

## Fase 3

- Cobro real de ecommerce por owner de complejo
- Reserva y liberacion de stock

## Fase 4

- Motor de reembolsos
- Paneles de aprobacion
- Ledger y auditoria

## Fase 5

- Planes avanzados
- cupones o bonificaciones
- chargebacks
- exportacion contable

## Recomendacion concreta para este repo

Mantener compatibilidad con lo actual, pero orientar la evolucion a esta estructura:

- `backend/src/modules/payments/paymentAccounts`
- `backend/src/modules/payments/monthlyCharges`
- `backend/src/modules/payments/bookingPayments`
- `backend/src/modules/payments/orderPayments`
- `backend/src/modules/payments/refunds`
- `backend/src/modules/payments/transactions`
- `backend/src/modules/payments/webhooks`

Y conservar temporalmente:

- `ownerBilling.js`
- `OwnerBilling.js`

hasta migrar esa logica a `MonthlyCharge`.

## Decisiones clave

- No usar suscripciones automaticas de Mercado Pago.
- Cada cobro es una entidad propia del dominio.
- Usar OAuth para cuentas receptoras de complejos.
- Mantener la mensualidad SaaS separada de reservas y ecommerce.
- Centralizar webhooks y ledger.
- Tratar reembolsos como dominio propio, no como un simple cambio de estado.

## Referencias oficiales a usar en implementacion

- OAuth Mercado Pago: https://www.mercadopago.com.br/developers/en/docs/security/oauth
- Creacion de preferencias Checkout Pro: https://www.mercadopago.com.br/developers/en/docs/checkout-pro/create-payment-preference
- Notificaciones y validacion de `x-signature`: https://www.mercadopago.cl/developers/en/docs/checkout-pro/payment-notifications
