# Firestore Security Specification — FreshMart Supermarket POS & Cloud ERP

## Phase 0: Data Invariants & Threat Model

### Collections & Ownership
1. `/admins/{uid}`: Server-provisioned admin registry. Client writes are ALWAYS denied. Bootstrapped super-admin (`mohammedilyassa@gmail.com`) is verified via `request.auth.token.email == 'mohammedilyassa@gmail.com' && request.auth.token.email_verified == true`.
2. `/users/{userId}`: Private operator profile. Only `userId == request.auth.uid` or verified admin can read. Users can create their own profile ONLY with `role == 'store_operator'` and immutable `uid`/`createdAt`. Users can never escalate `role` to `'admin'`.
3. `/stores/{storeId}`: Master Gate parent document for a store workspace. Owned by `ownerId == request.auth.uid` (or admin). `ownerId`, `companyId`, and `createdAt` are immutable after creation.
4. `/stores/{storeId}/liveDisplays/{counterId}`: Cross-device live POS Pole Display mirror. Protected by Master Gate `get(/databases/$(database)/documents/stores/$(storeId))` on `get`, `create`, `update`, and `delete` (verifying parent store exists and belongs to `request.auth.uid` or admin), plus `resource.data.ownerId == request.auth.uid || isAdmin()` on `list` (never using `get()` inside `list`).
5. `/stores/{storeId}/opsEvents/{eventId}`: Append-only live operational event stream (Delivery Dispatch, Wastage Alert, Add-On Toggle, POS Checkout). Protected by Master Gate `get()` on `get`/`create`/`delete`; `update` is strictly denied (`if false`) so audit events cannot be forged or altered.

### Global Hardening Rules
- Default-deny catch-all: `match /{document=**} { allow read, write: if false; }`.
- Every document ID validated with `isValidId(id)` (`^[a-zA-Z0-9_-]{1,128}$`).
- Every string bounded with `.size()`, every enum restricted to exact allow-lists, every numeric counter non-negative and upper-bounded.
- Server timestamps enforced via `request.time` (`createdAt == request.time` on create; `updatedAt == request.time` on create/update).
- Strict key whitelisting (`hasAll` + `hasOnly` on create; `affectedKeys().hasOnly(...)` on update).

## The Dirty Dozen — 12 Adversarial JSON Payloads (All Must Be Denied)

1. **Unauthenticated read of live display**
   - Path: `/stores/company_1/liveDisplays/LANE-01`
   - Auth: `null`
   - Operation: `get`
   - Expected: **DENY**

2. **Self-role escalation on user creation**
   - Path: `/users/attacker_uid`
   - Auth: `{ uid: "attacker_uid", email: "evil@example.com", email_verified: true }`
   - Payload: `{ "uid": "attacker_uid", "displayName": "Evil", "role": "admin", "createdAt": "<server>", "updatedAt": "<server>" }`
   - Expected: **DENY** (`role` must be `'store_operator'`)

3. **Self-role escalation on user update**
   - Path: `/users/user_1`
   - Auth: `{ uid: "user_1" }`
   - Operation: `update` `{ "role": "admin", "updatedAt": "<server>" }`
   - Expected: **DENY** (`role` is not in update allow-list for non-admins)

4. **Client write to `/admins` collection**
   - Path: `/admins/attacker_uid`
   - Auth: `{ uid: "attacker_uid" }`
   - Payload: `{ "uid": "attacker_uid", "email": "evil@example.com", "grantedAt": "<server>" }`
   - Expected: **DENY** (`allow write: if false`)

5. **Cross-tenant live display hijack (Owner mismatch)**
   - Path: `/stores/company_1/liveDisplays/LANE-01` (parent store owned by `owner_A`)
   - Auth: `{ uid: "owner_B" }`
   - Operation: `create` with `ownerId: "owner_B"`
   - Expected: **DENY** (Master Gate `get()` verifies parent store `ownerId == request.auth.uid`)

6. **Orphan subcollection write (Non-existent parent store)**
   - Path: `/stores/nonexistent_store/opsEvents/evt_1`
   - Auth: `{ uid: "owner_A" }`
   - Operation: `create`
   - Expected: **DENY** (Master Gate `get()` requires parent store to exist)

7. **Mass assignment / extra undeclared field injection**
   - Path: `/stores/company_1`
   - Auth: `{ uid: "owner_A" }`
   - Payload: `{ "ownerId": "owner_A", "companyId": 1, "storeName": "FreshMart", "enabledAddonsJson": "{}", "isSuperAdmin": true, "createdAt": "<server>", "updatedAt": "<server>" }`
   - Expected: **DENY** (`hasOnly` rejects `isSuperAdmin`)

8. **DoS oversized string payload (`linesJson` > 16KB)**
   - Path: `/stores/company_1/liveDisplays/LANE-01`
   - Auth: `{ uid: "owner_A" }`
   - Payload: `linesJson` of length 25000
   - Expected: **DENY** (`linesJson.size() <= 16000`)

9. **Immutable field mutation (`ownerId` / `createdAt` tampering on store update)**
   - Path: `/stores/company_1`
   - Auth: `{ uid: "owner_A" }`
   - Operation: `update` changing `ownerId` to `"owner_B"`
   - Expected: **DENY** (`affectedKeys().hasOnly(['storeName', 'enabledAddonsJson', 'updatedAt'])`)

10. **Audit log tampering (updating an immutable `opsEvents` document)**
    - Path: `/stores/company_1/opsEvents/evt_1`
    - Auth: `{ uid: "owner_A" }`
    - Operation: `update` `{ "detail": "Forged wastage log" }`
    - Expected: **DENY** (`allow update: if false`)

11. **Timestamp spoofing (forged future `createdAt`)**
    - Path: `/stores/company_1/opsEvents/evt_2`
    - Auth: `{ uid: "owner_A" }`
    - Payload: `createdAt: "2099-01-01T00:00:00Z"` instead of `request.time`
    - Expected: **DENY** (`createdAt == request.time`)

12. **Unverified email attempting admin bootstrap impersonation**
    - Path: `/stores/company_1` (owned by `other_uid`)
    - Auth: `{ uid: "spoof_uid", email: "mohammedilyassa@gmail.com", email_verified: false }`
    - Operation: `get`
    - Expected: **DENY** (`email_verified == true` is required)
