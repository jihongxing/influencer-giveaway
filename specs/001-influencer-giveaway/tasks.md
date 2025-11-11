# Tasks: Influencer Giveaway Platform

**Input**: Design documents from `/specs/001-influencer-giveaway/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are included per FamilyAuther Constitution requirements (TDD approach, 80% coverage for business logic, 95% for critical paths).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/src/`, `backend/tests/` at repository root
- **Frontend**: `miniprogram/` at repository root
- Paths follow plan.md structure (web application: backend + miniprogram)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create backend project structure (backend/src/, backend/tests/, backend/migrations/, backend/config/)
- [x] T002 Create miniprogram project structure (miniprogram/pages/, miniprogram/components/, miniprogram/services/, miniprogram/utils/)
- [x] T003 Initialize backend Node.js project with TypeScript in backend/
- [x] T004 [P] Initialize miniprogram project configuration (app.js, app.json) in miniprogram/
- [x] T005 [P] Configure ESLint and Prettier for backend TypeScript in backend/
- [x] T006 [P] Configure WeChat Developer Tools project settings in miniprogram/
- [x] T007 [P] Setup package.json with dependencies (wechat-api, mysql2, ioredis, sharp, jest) in backend/
- [x] T008 [P] Create .env.example with required environment variables in backend/config/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T009 Setup MySQL 8.0 database schema and migrations framework in backend/migrations/
- [x] T010 [P] Create database connection pool utility in backend/src/utils/db.ts
- [x] T011 [P] Setup Redis connection and caching utilities in backend/src/utils/cache.ts
- [x] T012 [P] Implement WeChat authentication middleware in backend/src/middleware/auth.ts
- [x] T013 [P] Setup API routing structure (Express/Fastify) in backend/src/api/
- [x] T014 [P] Configure error handling middleware in backend/src/middleware/errorHandler.ts
- [x] T015 [P] Setup logging infrastructure (Winston/Pino) in backend/src/utils/logger.ts
- [x] T016 [P] Create environment configuration manager in backend/src/config/index.ts
- [x] T017 [P] Setup image compression utility using sharp in backend/src/utils/imageCompression.ts
- [x] T018 [P] Create validation helpers (phone number, address format) in backend/src/utils/validation.ts
- [x] T019 [P] Setup WeChat Mini Program API service layer in miniprogram/services/api.ts
- [x] T020 [P] Create WeChat Mini Program app configuration and global state in miniprogram/app.js

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Influencer Creates Giveaway (Priority: P1) 🎯 MVP

**Goal**: Enable influencers to register, upload item photos, use AI to identify items, add markers, and publish shareable giveaway pages.

**Independent Test**: Can be fully tested by having an influencer complete registration, upload item photos, and receive a shareable giveaway page link. The test delivers a functional giveaway page that can be shared, even if no fans have claimed items yet.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T021 [P] [US1] Contract test for POST /auth/register in backend/tests/contract/test_auth_register.ts
- [x] T022 [P] [US1] Contract test for POST /auth/login in backend/tests/contract/test_auth_login.ts
- [x] T023 [P] [US1] Contract test for POST /items/upload-photos in backend/tests/contract/test_items_upload.ts
- [x] T024 [P] [US1] Contract test for POST /items/process in backend/tests/contract/test_items_process.ts
- [x] T025 [P] [US1] Contract test for POST /activities in backend/tests/contract/test_activities_create.ts
- [x] T026 [P] [US1] Contract test for POST /activities/{id}/publish in backend/tests/contract/test_activities_publish.ts
- [x] T027 [P] [US1] Integration test for influencer registration flow in backend/tests/integration/test_influencer_registration.ts
- [x] T028 [P] [US1] Integration test for giveaway creation flow in backend/tests/integration/test_giveaway_creation.ts
- [x] T029 [P] [US1] Unit test for Tencent Cloud AI service integration in backend/tests/unit/test_ai_service.ts
- [x] T030 [P] [US1] Unit test for image compression utility in backend/tests/unit/test_image_compression.ts

### Implementation for User Story 1

- [x] T031 [P] [US1] Create Influencer Account model in backend/src/models/influencer.ts
- [x] T032 [P] [US1] Create Giveaway Activity model in backend/src/models/giveawayActivity.ts
- [x] T033 [P] [US1] Create Item model in backend/src/models/item.ts
- [x] T034 [US1] Create database migration for influencer_account table in backend/migrations/001_create_influencer_account.ts
- [x] T035 [US1] Create database migration for giveaway_activity table in backend/migrations/002_create_giveaway_activity.ts
- [x] T036 [US1] Create database migration for item table in backend/migrations/003_create_item.ts
- [x] T037 [US1] Implement Tencent Cloud AI service client in backend/src/services/aiService.ts
- [x] T038 [US1] Implement file upload service (WeChat Cloud Storage + Tencent COS) in backend/src/services/fileStorageService.ts
- [x] T039 [US1] Implement shipping cost calculation service in backend/src/services/shippingCalculatorService.ts
- [x] T040 [US1] Implement QR code generation service in backend/src/services/qrCodeService.ts
- [x] T041 [US1] Implement Influencer service (registration, login) in backend/src/services/influencerService.ts
- [x] T042 [US1] Implement Item service (upload, AI processing, marker management) in backend/src/services/itemService.ts
- [x] T043 [US1] Implement Giveaway Activity service (create, update, publish) in backend/src/services/giveawayActivityService.ts
- [x] T044 [US1] Implement POST /auth/register endpoint in backend/src/api/auth.ts
- [x] T045 [US1] Implement POST /auth/login endpoint in backend/src/api/auth.ts
- [x] T046 [US1] Implement POST /items/upload-photos endpoint in backend/src/api/items.ts
- [x] T047 [US1] Implement POST /items/process endpoint in backend/src/api/items.ts
- [x] T048 [US1] Implement POST /activities endpoint in backend/src/api/activities.ts
- [x] T049 [US1] Implement PUT /activities/{id} endpoint in backend/src/api/activities.ts
- [x] T050 [US1] Implement POST /activities/{id}/publish endpoint in backend/src/api/activities.ts
- [x] T051 [US1] Implement GET /activities endpoint (influencer's activities) in backend/src/api/activities.ts
- [x] T052 [US1] Create influencer registration page in miniprogram/pages/register/
- [x] T053 [US1] Create giveaway creation page in miniprogram/pages/create-giveaway/
- [x] T054 [US1] Create item upload and marker management UI in miniprogram/pages/create-giveaway/
- [x] T055 [US1] Create activity list page in miniprogram/pages/my-activities/
- [x] T056 [US1] Integrate Tencent Cloud AI API calls in miniprogram/services/aiService.ts
- [x] T057 [US1] Add image compression before upload in miniprogram/utils/imageUtils.ts
- [x] T058 [US1] Add validation for phone number and address format in backend/src/utils/validation.ts

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Fan Claims Item (Priority: P2)

**Goal**: Enable fans to browse giveaway pages, select items, provide shipping info, complete payment, and view order status.

**Independent Test**: Can be fully tested by having a fan open a giveaway page link, select an available item, provide shipping details, complete payment, and receive confirmation. The test delivers a completed order even if logistics processing hasn't started.

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T059 [P] [US2] Contract test for GET /activities/public/{link_id} in backend/tests/contract/test_activities_public.ts
- [x] T060 [P] [US2] Contract test for POST /orders/claim in backend/tests/contract/test_orders_claim.ts
- [x] T061 [P] [US2] Contract test for POST /orders/{id}/confirm-payment in backend/tests/contract/test_orders_payment.ts
- [x] T062 [P] [US2] Contract test for GET /orders/{id} in backend/tests/contract/test_orders_get.ts
- [x] T063 [P] [US2] Contract test for GET /orders in backend/tests/contract/test_orders_list.ts
- [x] T064 [P] [US2] Integration test for fan claim and payment flow in backend/tests/integration/test_fan_claim_flow.ts
- [x] T065 [P] [US2] Unit test for WeChat Pay integration in backend/tests/unit/test_wechat_pay.ts
- [x] T066 [P] [US2] Unit test for order service in backend/tests/unit/test_orderService.ts

### Implementation for User Story 2

- [x] T067 [P] [US2] Create Order model in backend/src/models/order.ts
- [x] T068 [US2] Create database migration for order table in backend/migrations/004_create_order.ts
- [x] T069 [US2] Implement WeChat Pay service integration in backend/src/services/wechatPayService.ts
- [x] T070 [US2] Implement Order service (create, update, status management) in backend/src/services/orderService.ts
- [x] T071 [US2] Implement concurrent claim prevention (locking mechanism) in backend/src/services/orderService.ts
- [x] T072 [US2] Implement GET /activities/public/{link_id} endpoint in backend/src/api/activities.ts
- [x] T073 [US2] Implement POST /orders/claim endpoint in backend/src/api/orders.ts
- [x] T074 [US2] Implement POST /orders/{id}/confirm-payment endpoint in backend/src/api/orders.ts
- [x] T075 [US2] Implement GET /orders/{id} endpoint in backend/src/api/orders.ts
- [x] T076 [US2] Implement GET /orders endpoint (user's orders) in backend/src/api/orders.ts
- [x] T077 [US2] Implement POST /webhooks/wechat-pay webhook handler in backend/src/api/webhooks.ts
- [x] T078 [US2] Create public giveaway page in miniprogram/pages/giveaway/
- [x] T079 [US2] Create item claim page in miniprogram/pages/claim-item/
- [x] T080 [US2] Create payment page with WeChat Pay integration in miniprogram/pages/payment/
- [x] T081 [US2] Create order status page in miniprogram/pages/order-status/
- [x] T082 [US2] Create my orders list page in miniprogram/pages/my-orders/
- [x] T083 [US2] Add shipping address form validation in miniprogram/utils/validation.ts
- [x] T084 [US2] Integrate WeChat Pay SDK in miniprogram/services/paymentService.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Platform Processes Logistics (Priority: P3)

**Goal**: Automatically handle logistics by generating shipping labels, coordinating with shipping providers, and tracking orders through delivery.

**Independent Test**: Can be fully tested by having the system process a claimed order, generate shipping information, create a shipping label, and update order status. The test delivers logistics processing even if actual shipping hasn't occurred.

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T085 [P] [US3] Contract test for POST /orders/scan-match in backend/tests/contract/test_orders_scan_match.ts
- [x] T086 [P] [US3] Integration test for shipping label generation flow in backend/tests/integration/test_shipping_flow.ts
- [x] T087 [P] [US3] Unit test for shipping provider API integration in backend/tests/unit/test_shippingProviderService.ts
- [x] T088 [P] [US3] Unit test for shipping information service in backend/tests/unit/test_shippingInfoService.ts

### Implementation for User Story 3

- [x] T089 [P] [US3] Create Shipping Information model in backend/src/models/shippingInformation.ts
- [x] T090 [US3] Create database migration for shipping_information table in backend/migrations/005_create_shipping_information.ts
- [x] T091 [US3] Implement shipping provider API client (SF Express, YTO, ZTO, JD Logistics, Cainiao) in backend/src/services/shippingProviderService.ts
- [x] T092 [US3] Implement shipping label generation service in backend/src/services/shippingLabelService.ts
- [x] T093 [US3] Implement order tracking service in backend/src/services/orderTrackingService.ts
- [x] T094 [US3] Implement Shipping Information service in backend/src/services/shippingInfoService.ts
- [x] T095 [US3] Implement automatic shipping label generation after payment confirmation in backend/src/services/orderService.ts
- [x] T096 [US3] Implement POST /orders/scan-match endpoint (QR code matching) in backend/src/api/orders.ts
- [x] T097 [US3] Implement shipping provider webhook handlers for tracking updates in backend/src/api/webhooks.ts
- [x] T098 [US3] Create shipping label display page in miniprogram/pages/shipping-label/
- [x] T099 [US3] Create QR code scanner component for item matching in miniprogram/components/qr-scanner/
- [x] T100 [US3] Add order tracking display in miniprogram/pages/order-status/
- [x] T101 [US3] Implement profit calculation logic (fan payment - shipping cost) in backend/src/services/profitCalculatorService.ts

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Additional Features (Sharing & External Activities)

**Purpose**: Implement sharing posts and external activity timeline features

### Tests for Additional Features ⚠️

- [X] T102 [P] Contract test for POST /sharing-posts in backend/tests/contract/test_sharing_posts_create.ts
- [X] T103 [P] Contract test for GET /sharing-posts in backend/tests/contract/test_sharing_posts_list.ts
- [X] T104 [P] Contract test for POST /external-activities in backend/tests/contract/test_external_activities.ts

### Implementation for Additional Features

- [X] T105 [P] Create Sharing Post model in backend/src/models/sharingPost.ts
- [X] T106 [P] Create External Activity model in backend/src/models/externalActivity.ts
- [X] T107 Create database migration for sharing_post table in backend/migrations/006_create_sharing_post.ts
- [X] T108 Create database migration for external_activity table in backend/migrations/007_create_external_activity.ts
- [X] T109 Implement Sharing Post service in backend/src/services/sharingPostService.ts
- [X] T110 Implement External Activity service in backend/src/services/externalActivityService.ts
- [X] T111 Implement POST /sharing-posts endpoint in backend/src/api/sharingPosts.ts
- [X] T112 Implement GET /sharing-posts endpoint in backend/src/api/sharingPosts.ts
- [X] T113 Implement POST /sharing-posts/{id}/like endpoint in backend/src/api/sharingPosts.ts
- [X] T114 Implement POST /external-activities endpoint in backend/src/api/externalActivities.ts
- [X] T115 Implement GET /external-activities endpoint in backend/src/api/externalActivities.ts
- [X] T116 Create sharing area page in miniprogram/pages/sharing-area/
- [X] T117 Create external activity timeline component in miniprogram/components/activity-timeline/
- [X] T118 Add sharing post creation UI in miniprogram/pages/share-item/

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T119 [P] Add comprehensive error handling and user-friendly error messages across all endpoints
- [X] T120 [P] Implement rate limiting middleware in backend/src/middleware/rateLimiter.ts
- [X] T121 [P] Add request logging and monitoring in backend/src/middleware/requestLogger.ts
- [X] T122 [P] Optimize database queries with proper indexing (verify all indexes from data-model.md)
- [X] T123 [P] Implement Redis caching for frequently accessed data (giveaway pages, shipping costs)
- [X] T124 [P] Add performance monitoring and metrics collection
- [X] T125 [P] Implement image validation and content moderation in backend/src/utils/imageValidation.ts
- [X] T126 [P] Add comprehensive unit tests to achieve 80% coverage for business logic
- [X] T127 [P] Add integration tests for critical paths (payment, order processing) to achieve 95% coverage
- [X] T128 [P] Update API documentation with OpenAPI/Swagger spec
- [X] T129 [P] Add loading states and error handling in all miniprogram pages
- [X] T130 [P] Implement offline support and data synchronization in miniprogram/utils/offlineSync.ts
- [X] T131 [P] Add accessibility features (WCAG 2.1 AA compliance) in miniprogram components
- [X] T132 [P] Security hardening: Input sanitization, SQL injection prevention, XSS protection
- [X] T133 [P] Run quickstart.md validation and update if needed
- [X] T134 [P] Performance optimization: Image lazy loading, code splitting, bundle size optimization
- [X] T135 [P] Add comprehensive logging for debugging and monitoring

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Depends on US1 for Giveaway Activity and Item entities, but can be independently tested with mock data
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Depends on US2 for Order entity, but can be independently tested with mock orders
- **Additional Features**: Can start after US1-US3 - Depends on Order and Giveaway Activity entities

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all contract tests for User Story 1 together:
Task: "Contract test for POST /auth/register in backend/tests/contract/test_auth_register.ts"
Task: "Contract test for POST /auth/login in backend/tests/contract/test_auth_login.ts"
Task: "Contract test for POST /items/upload-photos in backend/tests/contract/test_items_upload.ts"
Task: "Contract test for POST /items/process in backend/tests/contract/test_items_process.ts"
Task: "Contract test for POST /activities in backend/tests/contract/test_activities_create.ts"
Task: "Contract test for POST /activities/{id}/publish in backend/tests/contract/test_activities_publish.ts"

# Launch all models for User Story 1 together:
Task: "Create Influencer Account model in backend/src/models/influencer.ts"
Task: "Create Giveaway Activity model in backend/src/models/giveawayActivity.ts"
Task: "Create Item model in backend/src/models/item.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add Additional Features → Test independently → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Influencer Creates Giveaway)
   - Developer B: User Story 2 (Fan Claims Item) - can start with mock data
   - Developer C: User Story 3 (Platform Processes Logistics) - can start with mock orders
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD approach)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- All tasks follow strict checklist format: `- [ ] [TaskID] [P?] [Story?] Description with file path`
- Total tasks: 135 tasks across 7 phases
- MVP scope: Phases 1-3 (Setup + Foundational + User Story 1)

