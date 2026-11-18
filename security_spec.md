# Security Specification & Hardening Audit

## 1. Data Invariants
1. **Admin Authority**: Only verified Google accounts in `/admins/{uid}` or the bootstrapped administrator email `gyansaimathsiitcentertech@gmail.com` (with `request.auth.token.email_verified == true`) can create, update, or delete `/folders/{folderId}`, `/exams/{examId}`, `/exams/{examId}/questions/{questionId}`, or read candidate PII (`/public_registrations`, `/exam_attempts`).
2. **Exam Visibility Isolation**: Unauthenticated or non-admin clients may only `get` or `list` `/exams/{examId}` and `/exams/{examId}/questions/{questionId}` where `isPublic == true`. Non-admin list queries must constrain `isPublic == true`.
3. **Orphan Prevention**: Every question under `/exams/{examId}/questions/{questionId}` must satisfy `data.examId == examId` and parent exam existence (`exists(...)`). Every `/public_registrations/{regId}` and `/exam_attempts/{attemptId}` must reference an existing `/exams/{examId}` document.
4. **PII Isolation**: `/public_registrations` and `/exam_attempts` contain student names, mobile numbers, and college names. They are write-once (`allow create` only) for public exam takers and strictly `allow read, update, delete: if isAdmin();` so no candidate can read another student's PII.
5. **Immutable Audit Timestamps & Creators**: `createdAt` / `submittedAt` must equal `request.time`, `createdByUid` must equal `request.auth.uid` on admin creates and remain immutable on update.
6. **ID Poisoning & Payload Size Guards**: All document IDs match `^[a-zA-Z0-9_\\-]+$` (`<= 128` chars), and every string and array (`questionIds <= 200`, `options <= 6`, `questionImageUrl`/`imageUrl <= 900000`) has explicit upper bounds.

## 2. "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unverified Admin Email Spoof**: User with `email == 'gyansaimathsiitcentertech@gmail.com'` and `email_verified == false` attempts to write `/exams/exam-1`. -> DENIED (`email_verified == true` enforced).
2. **Ghost Field Shadow Write on Exam Create**: Admin payload adds `"isFreeAdminOverride": true` to `/exams/exam-1`. -> DENIED (`keys().hasOnly(...)` enforced).
3. **Creator UID Spoofing**: Admin sets `createdByUid: 'other-uid'` on `/folders/f-1`. -> DENIED (`data.createdByUid == request.auth.uid`).
4. **Oversized Path ID Poisoning**: Client writes `/public_registrations/` with 500-char ID or invalid characters `../admin`. -> DENIED (`isValidId(regId)` enforced).
5. **Orphaned Question Creation**: Admin writes `/exams/nonexistent/questions/q-1` or mismatches `examId`. -> DENIED (`exists(...)` & `data.examId == examId`).
6. **Public Registration PII Scraping**: Non-admin executes `list` or `get` on `/public_registrations` or `/exam_attempts`. -> DENIED (`isAdmin()` required for read).
7. **Attempt Tampering After Submission**: Non-admin attempts `update` or `delete` on `/exam_attempts/{attemptId}` to alter `totalScore`. -> DENIED (only `create` allowed for non-admins; `update`/`delete` admin-only).
8. **Draft Exam Enumeration**: Non-admin queries `/exams` without `where('isPublic', '==', true)` or reads a draft (`isPublic: false`). -> DENIED (`resource.data.isPublic == true || isAdmin()`).
9. **Client Timestamp Forgery**: Payload submits `submittedAt: '2020-01-01'` instead of `request.time`. -> DENIED (`data.submittedAt == request.time`).
10. **Immutable Field Mutation**: Update attempts to change `createdAt` or `createdByUid` on `/exams/{examId}`. -> DENIED (`incoming().createdAt == existing().createdAt`).
11. **Unbounded Array / Payload Exhaustion**: Exam payload sends `questionIds` array of 500 items or `questionImageUrl` > 900KB. -> DENIED (`size() <= 200` and `size() <= 900000`).
12. **Self-Privilege Escalation**: Non-admin writes `/admins/{uid}` to promote themselves. -> DENIED (`isAdmin()` required for `/admins` writes).
