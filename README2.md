# Profit Decision Engine — 인수인계 문서

> **마지막 업데이트:** 2026-07-07 (Cursor 로컬, Agent 모드)  
> **목적:** 토큰 제한·계정 전환 시 다음 세션에서 바로 이어서 작업할 수 있도록 현재 상태를 기록합니다.

---

## 0. 한 줄 요약

Amazon 셀러용 BUY / SKIP / RISK 의사결정 SaaS. Next.js 14 + TypeScript. Stripe·Resend·Supabase(Postgres)·Apify·Amazon SP-API 연동. **외부 서비스가 전부 죽어도 mock으로 응답**하는 방어적 아키텍처가 핵심.

---

## 1. 이번 세션에서 완료한 작업 (1~5번)

사용자 요청: README2.md §10의 갭 항목 **1~5번 전부 처리**.

| # | 작업 | 상태 | 변경 파일 |
|---|------|------|-----------|
| 1 | Stripe webhook 멱등성 | ✅ 완료 | `src/lib/db/users.ts` (`tryClaimStripeEvent`), `src/app/api/stripe/webhook/route.ts` |
| 2 | ScanPanel retail URL 필드 | ✅ 완료 | `src/app/dashboard/scan-panel.tsx` — URL이면 `productUrl`, ASIN이면 `asin` 전송 |
| 3 | `upgradeUserToPro` 중복 정리 | ✅ 완료 | `src/lib/db/users.ts` 단일 진입점. `lib/db/upgrade.ts`, `lib/user/upgrade-user.ts` **삭제** |
| 4 | README / health 동기화 | ✅ 완료 | `README.md` (DB-free auth·멱등성 문서화), `src/app/api/health/route.ts` (`authMode: "jwt-magic-link"` 추가) |
| 5 | `.env.example` 생성 | ✅ 완료 | `.env.example` 신규, `.gitignore`에 `!.env.example` 추가 |

### 1-1. Stripe webhook 멱등성 (상세)

- `tryClaimStripeEvent(eventId)` — `processed_stripe_events`에 `INSERT ... ON CONFLICT DO NOTHING RETURNING event_id`
- 중복 delivery → `{ duplicate: true }` 반환, upgrade 재실행 안 함
- DB down 시 fail-open (`claimed: true, mock: true`) — Stripe 500 방지, README trade-off와 동일

### 1-2. ScanPanel URL 분기 (상세)

```ts
// scan-panel.tsx — isProductUrl()로 분기
{ productUrl: input, cost }  // http/https, amazon/costco/walmart/target/samsclub
{ asin: input.toUpperCase(), cost }  // 그 외
```

### 1-3. upgradeUserToPro 통합 (상세)

- 유일한 export: `src/lib/db/users.ts` → `upgradeUserToPro`, `tryClaimStripeEvent`
- webhook route import: `@/lib/db/users`

### 1-4. health 응답 예시

```json
{
  "ok": true,
  "status": "up",
  "services": { "db": "live|mock|error", "stripe": "...", "email": "...", "apify": "..." },
  "emailSignInAvailable": true,
  "authMode": "jwt-magic-link",
  "warnings": [],
  "timestamp": "..."
}
```

- `emailSignInAvailable`은 항상 `true` (DB 불필요). Resend 미설정 시 링크는 **서버 콘솔**에 출력.

### 1-5. .env.example

- `cp .env.example .env.local` 후 필요한 값만 채우면 됨
- `.gitignore`: `.env*` 패턴 유지 + `!.env.example`로 예외 처리

---

## 2. 빌드 검증

```bash
npm run build   # ✅ 2026-07-07 성공 (Next.js 14.2.35, 타입·린트 통과)
```

---

## 3. 아직 안 한 것 / 다음 우선순위

| 우선순위 | 작업 | 비고 |
|----------|------|------|
| **P0** | **git commit** | 아래 §4 변경분 아직 커밋 안 됨. 사용자가 요청 시에만 커밋 |
| P1 | Vercel 배포 설정 (6번, 선택) | `vercel.json` 없음. Cron은 README에 언급만 |
| P2 | 실서비스 env 채우기 | `.env.local`에 Supabase·Stripe·Resend·Apify·Amazon SP-API |
| P3 | `npm run db:migrate` | Supabase에 migration 3개 적용 |
| P4 | Stripe webhook 엔드포인트 등록 | `/api/stripe/webhook` + `STRIPE_WEBHOOK_SECRET` |
| P5 | E2E 수동 테스트 | 로그인 → 스캔 → checkout → webhook → Pro tier 확인 |

---

## 4. 미커밋 변경 파일 (다음 세션 시작 시 확인)

```
M  README.md
M  .gitignore
A  .env.example
M  src/app/api/health/route.ts
M  src/app/api/stripe/webhook/route.ts
M  src/app/dashboard/scan-panel.tsx
M  src/lib/db/users.ts
D  src/lib/db/upgrade.ts
D  src/lib/user/upgrade-user.ts
M  README2.md  (이 파일)
```

커밋 메시지 제안 (사용자 요청 시):
```
Fix code-doc gaps: webhook idempotency, ScanPanel URLs, env example

Consolidate Pro upgrade into users.ts, sync health/README with DB-free auth,
and add .env.example for handover.
```

---

## 5. 프로젝트 구조 (핵심만)

```
profit-decision-engine/
├── migrations/              # 001 auth, 002 app+stripe events, 003 tiktok cache
├── scripts/migrate.js       # npm run db:migrate
├── .env.example             # ★ 신규 — env 체크리스트
├── src/
│   ├── middleware.ts        # /dashboard 보호 (Edge, 쿠키 존재만)
│   ├── auth/
│   │   ├── auth.config.ts   # Edge-safe
│   │   └── auth.ts          # Node — HMAC 매직링크 + JWT (DB adapter 없음)
│   ├── lib/
│   │   ├── runtime-config.ts   # ★ 서비스 on/off 단일 진실원
│   │   ├── db/users.ts         # ★ upgradeUserToPro, tryClaimStripeEvent
│   │   ├── scan/               # run-scan, run-retail-scan, resolve-tier
│   │   ├── amazon/             # SP-API
│   │   ├── retail/             # Costco/Walmart/Target/Sam's Club
│   │   ├── apify/, tiktok/, stripe/, email/, mock/
│   └── app/
│       ├── dashboard/          # scan-panel.tsx, tiktok-trending-panel.tsx
│       └── api/                # scan, stripe/*, tiktok/*, health, auth/*
└── README.md                # 공식 아키텍처 문서 (이번에 동기화됨)
```

---

## 6. 핵심 아키텍처 (다음 세션 빠른 참고)

### 6-1. Fallback 패턴

1. `runtime-config.ts` — env + `FORCE_MOCK_*`로 live/mock 판단
2. lazy client init — throw 안 함
3. `safeQuery` — `{ ok: true } | { ok: false }`
4. 실패 시 deterministic mock — 500 거의 없음

### 6-2. 인증 (DB-free)

```
POST /api/auth/request-link → HMAC 토큰(15분) → Resend or 콘솔
GET  /auth/verify?token=...   → signIn("email") → JWT (tier: "free" 고정)
Pro tier                     → resolveTier()가 DB users.tier 조회 (Stripe webhook이 갱신)
```

### 6-3. 스캔

- ASIN/Amazon URL → `runScan()` (SP-API + Apify)
- 소매점 URL → `runRetailScan()` → Apify 스크래핑 → SP-API ASIN 매칭
- `POST /api/scan` body: `{ asin? , productUrl? , cost? }`

### 6-4. TikTok (Apify 비용 통제)

- GET `/api/tiktok/*` — DB 캐시만 (Apify 호출 없음)
- POST `/api/tiktok/refresh` — **유일한 Apify 호출** (로그인 + 5분 cooldown)

### 6-5. Stripe

- Checkout / Portal / Webhook 모두 구현
- Webhook: `checkout.session.completed` → `upgradeUserToPro` + 멱등성 guard

---

## 7. 환경변수

`.env.example` 참고. 프로덕션 필수: `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`.  
나머지는 없어도 앱 부팅·mock 응답 가능.

```bash
cp .env.example .env.local
npm run dev
# 상태 확인
curl http://localhost:3000/api/health
```

---

## 8. 외부 서비스 연동 현황

| 서비스 | 코드 | 비고 |
|--------|------|------|
| Apify | ✅ | TikTok, 소매점, Amazon 가격 |
| Stripe | ✅ | Checkout / Portal / Webhook |
| Resend | ✅ | 매직링크 (없으면 콘솔) |
| Supabase | ⚠️ | Postgres URL만 (SDK 없음) |
| Amazon SP-API | ✅ | 카탈로그, 수수료, 판매 제한 |
| Vercel | ❌ | vercel.json 없음 |
| GitHub / Cloudflare | ❌ | 인프라 레벨만 |

---

## 9. 다음 세션 시작 프롬프트 (복붙용)

```
@README2.md 만 읽고 현재 상태 파악한 뒤 이어서 작업해 줘.
우선순위: (1) 미커밋 변경 확인 (2) git commit (원하면) (3) Vercel 배포 설정 (4) 실서비스 테스트
```

또는 구체적으로:

```
README2.md 보고 P1 Vercel vercel.json 추가해 줘
```

```
README2.md 보고 Stripe webhook E2E 테스트 방법 정리해 줘
```

---

## 10. 알려진 트레이드오프 (변경 없음)

- `AUTH_SECRET` 미설정 시 dev fallback — `/api/health` warnings
- DB outage 중 webhook — 멱등성 불가, best-effort 처리
- JWT tier는 항상 `free` — Pro는 DB `users.tier`만 신뢰
- Apify 수동 refresh만 — Cron 없음 (비용 통제)
- TikTok 데이터 — Apify 스크래퍼 (ToS gray area, README에 문서화됨)

---

## 11. 원본 브리핑 보존 (참고)

이 문서는 클라우드 방 1개월 작업 → Cursor 로컬 이전 후, 코드 역브리핑을 기반으로 작성되었습니다.  
상세 아키텍처·보장 사항·테스트 매트릭스는 **`README.md`** (공식)를 참고하세요.  
`README2.md`는 **인수인계·작업 진행 상황** 전용입니다.
