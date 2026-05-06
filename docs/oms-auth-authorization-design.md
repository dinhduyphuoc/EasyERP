# OMS Authentication & Authorization Design

## 1. Mục tiêu

Thiết kế Authentication và Authorization cho OMS theo hướng production-ready, mở rộng được, và phù hợp với stack hiện tại:

- Backend: Express + TypeScript
- ORM/DB: Prisma + PostgreSQL
- Frontend: React + React Router

Thiết kế này bảo vệ các domain quan trọng:

- Orders
- Customers
- Products
- Inventory
- Warehouse operations
- Payments
- Reports
- Users/Admin
- Shipping integrations

## 2. Kiến trúc đề xuất

Áp dụng mô hình:

- Authentication: email/password + JWT access token + refresh token rotation
- Authorization: RBAC + permission-based access control + scope-based data access
- Data isolation: tenant/workspace + branch/warehouse scope
- Auditability: audit log cho login và thao tác nhạy cảm

Khuyến nghị production:

- `access_token`: JWT ngắn hạn, 15 phút
- `refresh_token`: opaque token hoặc JWT dài hạn 7-30 ngày, lưu ở DB dưới dạng hash
- Refresh token rotation mỗi lần refresh
- Revoke theo từng session hoặc toàn bộ user
- Password hashing: `Argon2id` ưu tiên, fallback `bcrypt`

## 3. Authentication Design

### 3.1 Login flow

1. User nhập `email` + `password`
2. Backend tìm user theo email normalized
3. Kiểm tra:
   - user tồn tại
   - `status = active`
   - email đã verify nếu policy yêu cầu
   - user chưa bị lock tạm thời
4. Verify password bằng `Argon2id.verify()`
5. Nếu thành công:
   - reset failed attempts
   - cập nhật `last_login_at`
   - tạo session/refresh token mới
   - trả về access token + refresh token
   - ghi audit log `auth.login_succeeded`
6. Nếu thất bại:
   - tăng login failure counter
   - nếu vượt ngưỡng thì throttle/lock
   - ghi audit log `auth.login_failed`

### 3.2 Token/session strategy

Khuyến nghị dùng:

- `Authorization: Bearer <access_token>` cho API
- `refresh_token` lưu trong cookie `httpOnly`, `secure`, `sameSite=strict|lax`

Lý do:

- access token ngắn hạn giảm blast radius
- refresh token trong cookie giảm lộ token ở frontend
- dễ revoke và rotate

JWT access token payload tối thiểu:

- `sub`: user_id
- `sid`: session_id
- `tenant_id`
- `role_slugs`
- `permissions_version`
- `scope_version`
- `iat`
- `exp`

Không nhét quá nhiều permission chi tiết vào JWT nếu có thể thay đổi thường xuyên. Nên cache quyền ở backend hoặc load từ DB/Redis.

### 3.3 Expiration

- Access token: 15 phút
- Refresh token: 30 ngày
- Idle timeout session: 7 ngày không hoạt động thì hết hạn
- Absolute session lifetime: 30 ngày

### 3.4 Logout

- Logout current session:
  - revoke refresh token/session hiện tại
  - client xoá access token trong memory
  - xoá cookie refresh token
- Logout all devices:
  - revoke toàn bộ session active của user
  - tăng `token_version` hoặc `session_version`

Audit log:

- `auth.logout`
- `auth.logout_all`

### 3.5 Forgot/reset password

Flow:

1. User submit email
2. Backend luôn trả response chung để tránh email enumeration
3. Tạo reset token một lần, TTL 15 phút
4. Gửi email link reset
5. Khi reset thành công:
   - hash password mới
   - revoke toàn bộ session active
   - xóa reset token
   - ghi audit log `auth.password_reset_succeeded`

Không lưu reset token plaintext trong DB, chỉ lưu hash.

### 3.6 Email verification

Khuyến nghị dùng cho:

- admin-created accounts
- self-registration nếu OMS có mở luồng này
- thay đổi email

Lưu verification token dạng hash, TTL 24 giờ.

### 3.7 Rate limiting và lock/throttle

Áp dụng ở `POST /auth/login`:

- IP rate limit: ví dụ 10 requests / 5 phút / IP
- Email+IP rate limit: ví dụ 5 failures / 15 phút
- Progressive delay:
  - lần 5: delay 30s
  - lần 7: delay 5 phút
  - lần 10: lock 30 phút

DB fields đề xuất:

- `failed_login_attempts`
- `locked_until`
- `last_failed_login_at`

### 3.8 Audit log cho auth

Ghi log các sự kiện:

- login success/failure
- logout
- refresh token used
- refresh token reuse detected
- forgot password requested
- password reset success/failure
- email verification success/failure
- account locked/unlocked

Metadata nên gồm:

- `actor_user_id`
- `target_user_id`
- `tenant_id`
- `ip_address`
- `user_agent`
- `request_id`
- `session_id`

## 4. User Model

Schema tối thiểu theo yêu cầu:

- `id`
- `full_name`
- `email`
- `password_hash`
- `role`
- `status`
- `last_login_at`
- `created_at`
- `updated_at`

Khuyến nghị mở rộng thực tế:

```prisma
enum UserStatus {
  active
  inactive
  blocked
}

model User {
  id                     String      @id @default(cuid())
  tenant_id              String?
  full_name              String
  email                  String      @unique
  email_normalized       String      @unique
  password_hash          String
  status                 UserStatus  @default(active)
  is_email_verified      Boolean     @default(false)
  last_login_at          DateTime?
  failed_login_attempts  Int         @default(0)
  last_failed_login_at   DateTime?
  locked_until           DateTime?
  token_version          Int         @default(0)
  created_at             DateTime    @default(now())
  updated_at             DateTime    @updatedAt

  tenant                 Tenant?     @relation(fields: [tenant_id], references: [id])
  roles                  UserRole[]
  sessions               Session[]
  scopes                 UserScope[]
  audit_logs             AuditLog[]  @relation("AuditActor")

  @@index([tenant_id])
  @@index([status])
}
```

Ghi chú:

- Nếu cần giữ `role` trực tiếp trong `users` cho đơn giản ban đầu, vẫn nên chuyển sang `user_roles` để hỗ trợ multi-role.
- `email_normalized` nên lowercase + trim.

## 5. Authorization Model

### 5.1 Mô hình đề xuất

Nên dùng:

- RBAC cho role chuẩn
- Permission table cho quyền chi tiết
- Scope-based filtering cho tenant/warehouse/branch

Tức là quyền hiệu lực = `role permissions` + `optional direct grants/deny` + `data scope`.

### 5.2 Roles tối thiểu

- `super_admin`
- `admin`
- `sales`
- `warehouse`
- `accountant`
- `customer_support`
- `viewer`

### 5.3 Permission naming

Chuẩn hoá theo `resource.action`:

- `orders.create`
- `orders.read`
- `orders.update`
- `orders.cancel`
- `orders.refund`
- `orders.export`
- `customers.create`
- `customers.read`
- `customers.update`
- `customers.delete`
- `products.create`
- `products.read`
- `products.update`
- `products.delete`
- `inventory.read`
- `inventory.adjust`
- `inventory.reserve`
- `inventory.release`
- `warehouse.pick`
- `warehouse.pack`
- `warehouse.ship`
- `warehouse.return`
- `payments.read`
- `payments.capture`
- `payments.refund`
- `payments.reconcile`
- `reports.read`
- `reports.export`
- `users.create`
- `users.read`
- `users.update`
- `users.disable`
- `users.assign_role`
- `settings.read`
- `settings.update`
- `audit_logs.read`

### 5.4 Role matrix gợi ý

| Role | Quyền chính |
|---|---|
| `super_admin` | toàn quyền, bao gồm tenant-wide admin và credential policy |
| `admin` | vận hành, users, settings, reports, audit logs, không được tự nâng lên `super_admin` |
| `sales` | orders create/read/update/cancel/export, customers create/read/update |
| `warehouse` | inventory read/reserve/release, warehouse pick/pack/ship/return |
| `accountant` | orders read, payments read/capture/refund/reconcile, reports read/export |
| `customer_support` | orders read, customers read/update, support actions |
| `viewer` | read-only theo scope được cấp |

Quy tắc cứng:

- Chỉ `super_admin` được gán `admin` hoặc `super_admin`
- `admin` không được tự cấp `super_admin` cho bản thân hoặc người khác
- `sales` không có `payments.refund`
- `warehouse` không có quyền payment
- `accountant` không có `inventory.adjust` nếu không được grant riêng

## 6. Data Access Control

### 6.1 Scope model

OMS nên hỗ trợ:

- tenant/workspace scope
- branch scope
- warehouse scope
- optional sales ownership scope

Đề xuất table:

```prisma
enum ScopeType {
  tenant
  branch
  warehouse
  sales_channel
  customer_segment
}

model UserScope {
  id           String    @id @default(cuid())
  user_id       String
  tenant_id     String
  scope_type    ScopeType
  scope_value   String
  created_at    DateTime  @default(now())

  user          User      @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, tenant_id, scope_type, scope_value])
  @@index([tenant_id, scope_type, scope_value])
}
```

### 6.2 Cách enforce

Ví dụ với `orders.read`:

- `super_admin`: bỏ qua scope trong tenant
- `admin`: đọc toàn tenant
- `sales`: chỉ đơn do mình tạo hoặc thuộc branch/team được cấp
- `warehouse`: chỉ đơn thuộc warehouse được cấp
- `accountant`: chỉ đơn thuộc tenant hoặc branch kế toán phụ trách
- `viewer`: read-only nhưng vẫn bị giới hạn theo scope

Backend phải check:

1. User có permission phù hợp
2. Record có nằm trong scope của user không

Không bao giờ chỉ ẩn nút ở frontend mà bỏ check ở backend.

### 6.3 Gợi ý bổ sung schema domain

Để enforce scope tốt hơn, nên thêm vào các bảng nghiệp vụ:

- `tenant_id` cho các bảng business chính
- `branch_id` cho `Order`, `Customer`, `Payment`
- `warehouse_id` cho `InventoryStock`, `InventoryTransaction`, `Order`, `ShippingConnection`
- `created_by_user_id` cho `Order`

Ví dụ:

```prisma
model Order {
  id                  Int       @id @default(autoincrement())
  tenant_id           String
  branch_id           String?
  warehouse_id        String?
  created_by_user_id  String?
  ...

  @@index([tenant_id, branch_id])
  @@index([tenant_id, warehouse_id])
  @@index([created_by_user_id])
}
```

## 7. Admin Module Flow

Admin flow nên gồm:

- quản lý user
- cấp/thu hồi role
- khóa/mở khóa tài khoản
- revoke session
- xem audit log
- xem và quản lý scope
- quản lý permission matrix nếu cần

Quy tắc:

- `super_admin` mới được tạo hoặc gán `admin`, `super_admin`
- `admin` chỉ quản lý role thấp hơn
- thay đổi role/scope phải bắt buộc ghi audit log
- không cho user tự sửa role nhạy cảm của chính mình

## 8. API Design

### 8.1 Auth APIs

- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `POST /auth/refresh`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/verify-email`
- `POST /auth/resend-verification`
- `GET /auth/me`
- `POST /auth/change-password`

### 8.2 User APIs

- `GET /users/me`
- `PATCH /users/me`
- `GET /users/:id`
- `GET /users`

### 8.3 Role/Permission APIs

- `GET /roles`
- `GET /permissions`
- `GET /roles/:id/permissions`
- `PUT /roles/:id/permissions`
- `GET /users/:id/roles`
- `PUT /users/:id/roles`
- `GET /users/:id/scopes`
- `PUT /users/:id/scopes`

### 8.4 Admin APIs

- `POST /admin/users`
- `PATCH /admin/users/:id`
- `POST /admin/users/:id/block`
- `POST /admin/users/:id/unblock`
- `POST /admin/users/:id/disable`
- `POST /admin/users/:id/activate`
- `POST /admin/users/:id/revoke-sessions`
- `GET /admin/audit-logs`
- `GET /admin/sessions`

### 8.5 Middleware / guard

- `authenticate()`
- `requireActiveUser()`
- `requirePermission('orders.read')`
- `requireAnyRole(['admin', 'super_admin'])`
- `requireScope({ resource: 'order', action: 'read' })`
- `rateLimit('auth.login')`
- `csrfProtection()` nếu dùng cookie auth
- `auditTrail()` cho action nhạy cảm

Ví dụ Express flow:

```ts
router.get(
  "/orders/:id",
  authenticate(),
  requireActiveUser(),
  requirePermission("orders.read"),
  requireOrderScope("read"),
  controller.getById,
);
```

### 8.6 Chuẩn response 401/403

`401 Unauthorized`

```json
{
  "error": {
    "code": "AUTH_UNAUTHORIZED",
    "message": "Authentication required",
    "request_id": "req_123"
  }
}
```

`403 Forbidden`

```json
{
  "error": {
    "code": "AUTH_FORBIDDEN",
    "message": "You do not have permission to perform this action",
    "request_id": "req_123",
    "details": {
      "required_permission": "payments.refund"
    }
  }
}
```

## 9. Database Design

### 9.1 Core tables

```prisma
model Tenant {
  id          String     @id @default(cuid())
  name        String
  slug        String     @unique
  status      String     @default("active")
  created_at  DateTime   @default(now())
  updated_at  DateTime   @updatedAt

  users       User[]
  roles       Role[]
}

model Role {
  id          String            @id @default(cuid())
  tenant_id   String?
  slug        String
  name        String
  description String?
  is_system    Boolean          @default(true)
  created_at   DateTime         @default(now())
  updated_at   DateTime         @updatedAt

  tenant       Tenant?          @relation(fields: [tenant_id], references: [id])
  permissions  RolePermission[]
  users        UserRole[]

  @@unique([tenant_id, slug])
}

model Permission {
  id          String            @id @default(cuid())
  code        String            @unique
  description String?
  created_at  DateTime          @default(now())

  roles       RolePermission[]
}

model RolePermission {
  role_id        String
  permission_id  String

  role           Role        @relation(fields: [role_id], references: [id], onDelete: Cascade)
  permission     Permission  @relation(fields: [permission_id], references: [id], onDelete: Cascade)

  @@id([role_id, permission_id])
}

model UserRole {
  user_id     String
  role_id     String
  assigned_by String?
  assigned_at DateTime @default(now())

  user        User   @relation(fields: [user_id], references: [id], onDelete: Cascade)
  role        Role   @relation(fields: [role_id], references: [id], onDelete: Cascade)

  @@id([user_id, role_id])
}
```

### 9.2 Sessions / refresh tokens

```prisma
model Session {
  id                  String    @id @default(cuid())
  user_id             String
  tenant_id           String?
  refresh_token_hash  String
  user_agent          String?
  ip_address          String?
  device_name         String?
  expires_at          DateTime
  idle_expires_at     DateTime?
  last_used_at        DateTime?
  revoked_at          DateTime?
  revoke_reason       String?
  created_at          DateTime  @default(now())
  updated_at          DateTime  @updatedAt

  user                User      @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id, expires_at])
  @@index([tenant_id])
}
```

### 9.3 Audit logs

```prisma
model AuditLog {
  id               String    @id @default(cuid())
  tenant_id        String?
  actor_user_id    String?
  target_user_id   String?
  action           String
  resource_type    String
  resource_id      String?
  status           String
  ip_address       String?
  user_agent       String?
  request_id       String?
  metadata_json    Json      @default("{}")
  created_at       DateTime  @default(now())

  actor            User?     @relation("AuditActor", fields: [actor_user_id], references: [id])

  @@index([tenant_id, action, created_at(sort: Desc)])
  @@index([actor_user_id, created_at(sort: Desc)])
  @@index([resource_type, resource_id])
}
```

### 9.4 Tokens cho reset/verify

```prisma
model UserToken {
  id           String    @id @default(cuid())
  user_id       String
  token_type    String
  token_hash    String
  expires_at    DateTime
  consumed_at   DateTime?
  created_at    DateTime  @default(now())

  user          User      @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id, token_type])
}
```

## 10. Security Controls

### 10.1 Password handling

- Không lưu plaintext password
- Dùng `Argon2id`
- Parameters khuyến nghị:
  - memory cost: 64MB hoặc cao hơn tùy hạ tầng
  - time cost: 3
  - parallelism: 1-2
- Rehash password khi policy tăng độ mạnh

### 10.2 Secret management

- JWT secret/private key lưu trong env hoặc secret manager
- Không commit vào repo
- Tách key cho:
  - access token signing
  - refresh token signing nếu dùng JWT refresh
  - data encryption key wrapping

### 10.3 Cookie security

Nếu dùng cookie:

- `httpOnly: true`
- `secure: true`
- `sameSite: "lax"` hoặc `"strict"`
- `path: /auth`

### 10.4 CSRF / CORS

- Nếu refresh token nằm trong cookie, bật CSRF protection cho endpoint state-changing
- CORS whitelist rõ ràng theo env
- Không dùng `origin: *` với credentialed request

### 10.5 Sensitive logging

Không log:

- password
- reset token
- refresh token
- access token
- API key
- shipping credential
- payment secret

Chỉ log giá trị đã mask.

### 10.6 Audit cho thao tác nhạy cảm

Phải audit:

- đổi role
- revoke session
- block/unblock user
- huỷ đơn
- hoàn tiền
- chỉnh tồn kho
- xóa dữ liệu
- đổi cấu hình shipping/payment

## 11. Chỉnh security cho credential đơn vị vận chuyển

### 11.1 Vấn đề hiện tại

Trong schema hiện tại:

- `ShippingConnection.credentials_json Json?`

Trong service hiện tại:

- credential được validate rồi lưu trực tiếp vào DB

Điều này không đạt yêu cầu security production vì credential đang ở dạng đọc được nếu DB bị lộ hoặc có query trực tiếp.

### 11.2 Thiết kế mới khuyến nghị

Không lưu credential plaintext trong database.

Áp dụng 1 trong 2 phương án:

1. Ưu tiên: secret manager ngoài DB
   - AWS Secrets Manager / GCP Secret Manager / HashiCorp Vault
   - DB chỉ lưu `secret_ref`
2. Nếu phải lưu DB:
   - dùng envelope encryption
   - mỗi record có DEK riêng
   - DEK được wrap bằng KEK từ secret manager/env
   - dữ liệu mã hóa bằng AES-256-GCM

### 11.3 Schema khuyến nghị

Thay vì `credentials_json`, dùng:

```prisma
model ShippingConnectionSecret {
  id                    String    @id @default(cuid())
  shipping_connection_id Int      @unique
  secret_provider       String    // db, aws_secrets_manager, vault
  secret_ref            String?
  encrypted_payload     Bytes?
  dek_wrapped           Bytes?
  key_version           Int       @default(1)
  created_at            DateTime  @default(now())
  updated_at            DateTime  @updatedAt

  shipping_connection   ShippingConnection @relation(fields: [shipping_connection_id], references: [id], onDelete: Cascade)
}
```

`ShippingConnection` chỉ giữ:

- `has_credentials`
- `last_verified_at`
- `status`
- metadata đã sanitize

### 11.4 Runtime access pattern

1. User có quyền `settings.update` hoặc permission riêng `shipping.credentials.manage`
2. Backend nhận credential
3. Backend mã hóa trước khi lưu, hoặc đẩy vào secret manager
4. Khi verify/call provider:
   - backend đọc secret
   - giải mã trong memory
   - không log raw values
   - zero out object reference sớm nhất có thể

### 11.5 Permission riêng cho secret

Khuyến nghị thêm:

- `shipping.credentials.read_masked`
- `shipping.credentials.update`
- `shipping.credentials.verify`

Chỉ `admin` hoặc `super_admin` được cấp.

## 12. Frontend Flow

### 12.1 Login page

Gồm:

- email
- password
- remember me nếu cần
- forgot password link
- hiển thị lỗi chung, không tiết lộ email tồn tại hay không

### 12.2 Forgot password page

- nhập email
- luôn trả thông báo chung
- sau reset thành công chuyển về login

### 12.3 Protected route

Route phải check:

- có access token/session
- user active
- token chưa hết hạn

Nếu fail:

- chuyển về `/login`

### 12.4 Admin route

Ngoài auth, phải check role/permission:

- `users.read`
- `users.assign_role`
- `audit_logs.read`
- `settings.update`

Nếu không đủ quyền:

- chuyển `/403`

### 12.5 403 page

Hiển thị:

- không đủ quyền
- nút quay lại dashboard
- không leak thông tin resource nhạy cảm

### 12.6 Menu và action visibility

Frontend nên:

- ẩn menu nếu không có permission
- không render action button nếu user không có permission
- disable hoặc ẩn nút refund/cancel/adjust khi không đủ quyền

Nhưng backend vẫn phải enforce đầy đủ.

## 13. Testing Matrix

### 13.1 Authentication tests

- login thành công với email/password đúng
- login thất bại với password sai
- blocked user không login được
- inactive user không login được
- email chưa verify bị chặn nếu policy bật
- token hết hạn bị trả `401`
- refresh token hết hạn bị từ chối
- refresh token đã revoke bị từ chối
- refresh token reuse bị phát hiện và revoke session
- logout current session thành công
- logout all sessions thành công

### 13.2 Authorization tests

- user chưa login gọi API protected bị `401`
- user không đủ quyền nhận `403`
- `sales` không được `payments.refund`
- `warehouse` không được chỉnh payment
- `accountant` không được `inventory.adjust` nếu không có quyền
- `admin` không được tự nâng lên `super_admin`
- `super_admin` cấp `admin` thành công
- `viewer` chỉ đọc được dữ liệu trong scope

### 13.3 Scope tests

- user không xem được order ngoài scope
- warehouse A không đọc inventory warehouse B
- sales chỉ thấy order do mình tạo hoặc branch được cấp
- accountant chỉ xem payment thuộc tenant/branch được cấp

### 13.4 Audit tests

- login success/failure đều ghi audit log
- role change ghi actor và target
- refund ghi audit log
- inventory adjustment ghi audit log
- shipping credential update chỉ log masked metadata

## 14. Triển khai vào codebase hiện tại

### 14.1 Backend modules nên thêm

- `src/modules/auth`
- `src/modules/user`
- `src/modules/admin`
- `src/modules/rbac`
- `src/common/middleware/authenticate.ts`
- `src/common/middleware/require-permission.ts`
- `src/common/middleware/require-scope.ts`
- `src/common/middleware/rate-limit.ts`
- `src/common/services/audit-log.service.ts`
- `src/common/services/crypto.service.ts`

### 14.2 Prisma migration ưu tiên

1. thêm `users`, `roles`, `permissions`, `user_roles`, `role_permissions`
2. thêm `sessions`, `user_tokens`, `audit_logs`
3. thêm `tenant`, `user_scopes`
4. thêm `tenant_id`, `warehouse_id`, `created_by_user_id` vào bảng nghiệp vụ cần thiết
5. tách `ShippingConnection.credentials_json` sang encrypted secret storage

### 14.3 Middleware chain trong `app.ts`

Khuyến nghị:

1. `helmet`
2. request id
3. cors policy theo env
4. body parser
5. auth parser
6. route-level authz guards
7. error handler chuẩn

### 14.4 Package đề xuất

- `argon2`
- `jsonwebtoken` hoặc `jose`
- `cookie-parser`
- `helmet`
- `csurf` hoặc CSRF solution tương đương
- `rate-limiter-flexible`
- `zod`

## 15. Kết luận

Thiết kế phù hợp nhất cho OMS hiện tại là:

- Authentication bằng email/password + Argon2id
- Access token ngắn hạn + refresh token rotation có revoke
- Authorization theo RBAC + permission + scope
- Enforce quyền ở backend cho mọi API quan trọng
- Audit đầy đủ cho auth và thao tác nhạy cảm
- Không lưu credential vận chuyển dạng plaintext trong DB, thay bằng secret manager hoặc encrypted secret store

Nếu triển khai theo hướng này, OMS sẽ đủ nền tảng để:

- chạy production an toàn hơn
- hỗ trợ multi-tenant/multi-warehouse
- mở rộng role và permission về sau
- giảm rủi ro lộ credential tích hợp bên thứ ba
