# Profit Decision Engine — 인수인계 문서

> **마지막 업데이트:** 2026-07-07 (Cursor 로컬, Agent 모드)  
> **최신 커밋:** `git log -1 --oneline` 참고 (현재 `f31f6c9` 근처)  
> **목적:** 토큰 제한·계정 전환 시 다음 세션에서 바로 이어서 작업할 수 있도록 현재 상태를 기록합니다.  
> **규칙:** 이 파일은 작업할 때마다 **항상** 최신 상태로 업데이트한다 (별도 명령 불필요).

---

## 0. 한 줄 요약

Amazon 셀러용 BUY / SKIP / RISK 의사결정 SaaS. Next.js 14 + TypeScript. Stripe·Resend·Supabase(Postgres)·Apify·Amazon SP-API 연동. **외부 서비스가 전부 죽어도 mock으로 응답**하는 방어적 아키텍처가 핵심.

---

## 1. 완료된 작업 (1~6번 전부)

| # | 작업 | 상태 | 핵심 변경 |
|---|------|------|-----------|
| 1 | Stripe webhook 멱등성 | ✅ | `tryClaimStripeEvent()` → `processed_stripe_events` INSERT ON CONFLICT |
| 2 | ScanPanel retail URL | ✅ | URL → `productUrl`, ASIN → `asin` |
| 3 | `upgradeUserToPro` 통합 | ✅ | `users.ts` 단일화, `upgrade.ts` / `upgrade-user.ts` 삭제 |
| 4 | README / health 동기화 | ✅ | DB-free auth 문서화, `authMode: "jwt-magic-link"` |
| 5 | `.env.example` | ✅ | 생성 + `.gitignore`에 `!.env.example` |
| 6 | Vercel 배포 설정 | ✅ | `vercel.json` (Next.js, `iad1`). Cron **미포함** (Apify 수동 refresh 설계 유지) |

**커밋:** `3f9155e` on `main` — working tree clean.

---

## 2. 빌드 검증

```bash
npm run build   # ✅ 2026-07-07 성공
```

---

## 3. 다음 우선순위

| 우선순위 | 작업 | 비고 |
|----------|------|------|
| **P0** | `git push origin main` | 로컬 커밋만 있음. 사용자 요청 시 push |
| P1 | Vercel 프로젝트 연결 + env 설정 | `.env.example` → Vercel Environment Variables |
| P2 | Supabase migration | `DATABASE_URL=... npm run db:migrate` |
| P3 | Stripe webhook 등록 | `https://<domain>/api/stripe/webhook` |
| P4 | E2E 수동 테스트 | 로그인 → 스캔 → checkout → Pro tier |
| P5 | (선택) Cron route 추가 | `CRON_SECRET` 보호 `/api/cron/*` + `vercel.json` crons |

---

## 4. Vercel 배포 체크리스트

1. Vercel에서 repo import
2. Environment Variables (`.env.example` 참고):
   - 필수: `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`
   - DB: `DATABASE_URL` (Supabase)
   - Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs
   - Email: `RESEND_API_KEY`, `EMAIL_FROM`
   - Apify: `APIFY_API_TOKEN`
   - Amazon: `AMAZON_*`
3. Deploy 후 `GET /api/health` 확인
4. Stripe Dashboard → Webhook endpoint 등록
5. Supabase에 migration 적용 (로컬에서 production URL로 `db:migrate`)

`vercel.json` 내용:
```json
{ "framework": "nextjs", "regions": ["iad1"] }
```

---

## 5. 핵심 파일 위치

| 영역 | 파일 |
|------|------|
| 서비스 on/off | `src/lib/runtime-config.ts` |
| Stripe webhook + 멱등성 | `src/app/api/stripe/webhook/route.ts`, `src/lib/db/users.ts` |
| 스캔 UI | `src/app/dashboard/scan-panel.tsx` |
| Health | `src/app/api/health/route.ts` |
| Auth (DB-free) | `src/auth/auth.ts`, `src/lib/auth/magic-token.ts` |
| Env 체크리스트 | `.env.example` |
| 공식 아키텍처 문서 | `README.md` |
| 배포 설정 | `vercel.json` |

---

## 6. 아키텍처 빠른 참고

### Fallback 패턴
`runtime-config` → lazy init → `safeQuery` / try-catch → mock fallback. 500 거의 없음.

### 인증 (DB-free)
```
POST /api/auth/request-link → HMAC 토큰(15분) → Resend or 콘솔
GET  /auth/verify?token=...  → JWT (tier: "free" 고정)
Pro tier → DB users.tier (Stripe webhook이 갱신)
```

### 스캔
- ASIN/Amazon URL → `runScan()` (SP-API + Apify)
- 소매점 URL → `runRetailScan()` → `productUrl` 필드
- `POST /api/scan` body: `{ asin?, productUrl?, cost? }`

### TikTok (Apify 비용 통제)
- GET `/api/tiktok/*` — DB 캐시만
- POST `/api/tiktok/refresh` — 유일한 사용자-facing Apify 호출 (5분 cooldown)

### Stripe webhook 흐름
```
checkout.session.completed
  → tryClaimStripeEvent(event.id)  // 중복이면 skip
  → upgradeUserToPro(email, stripeIds)
```

---

## 7. 환경변수

`.env.example` 참고. 없어도 부팅·mock 응답 가능.

```bash
cp .env.example .env.local
npm run dev
curl http://localhost:3000/api/health
```

---

## 8. 외부 서비스 현황

| 서비스 | 상태 |
|--------|------|
| Apify, Stripe, Resend, Amazon SP-API | ✅ 코드 연동 |
| Supabase | ⚠️ Postgres URL만 (SDK 없음) |
| Vercel | ✅ `vercel.json` 추가 (배포 준비) |
| GitHub / Cloudflare | 인프라 레벨만 |

---

## 9. 다음 세션 시작 프롬프트 (복붙용)

```
@README2.md 만 읽고 현재 상태 파악한 뒤 이어서 작업해 줘.
```

구체적 예:
```
README2.md 보고 Vercel env 설정 가이드 더 자세히 써 줘
```
```
README2.md 보고 git push 해 줘
```

---

## 10. 알려진 트레이드오프

- `AUTH_SECRET` 미설정 → dev fallback (health warnings)
- DB outage 중 webhook → 멱등성 불가, best-effort
- JWT tier 항상 `free` — Pro는 DB만 신뢰
- Apify 수동 refresh만 — Cron 없음 (의도적)
- TikTok — Apify 스크래퍼 (ToS gray area)

---

## 11. 문서 역할 구분

| 파일 | 용도 |
|------|------|
| `README.md` | 공식 아키텍처·설정·보장 사항 |
| `README2.md` | **인수인계·작업 진행 상황** (이 파일) |
