# Profit Decision Engine — 인수인계 문서

> **마지막 업데이트:** 2026-07-07 14:48 (Cursor 로컬, Agent 모드)  
> **최신 커밋:** `git log -1 --oneline` 참고 (이번 push 직후 확인)  
> **목적:** 토큰 제한·계정 전환 시 다음 세션에서 바로 이어서 작업할 수 있도록 현재 상태를 기록합니다.  
> **규칙:** 이 파일은 작업할 때마다 **항상** 최신 상태로 업데이트한다 (별도 명령 불필요).

---

## ⚠️ 세션 중단점 — 다음 계정이 여기서 시작

**이 세션에서 멈춤.** 아래는 이미 끝난 것 — **다시 하지 말 것:**

| 항목 | 상태 | 비고 |
|------|------|------|
| git push | ✅ 완료 | `origin/main` = `90c3b88` |
| Vercel link | ✅ 완료 | `.vercel/` 생성됨 (gitignored) |
| 프로덕션 health | ✅ 확인 | 전 서비스 `live`, warnings `[]` |
| `npm run build` | ✅ 성공 | 2026-07-07 |
| `npm run smoke` (로컬) | ✅ 5/5 | `http://localhost:3000` |
| smoke-test 스크립트 작성 | ✅ 완료 | `scripts/smoke-test.js` (아직 미커밋) |

**미커밋 변경 (워킹 트리):**
```
 M README2.md
 M package.json
?? scripts/smoke-test.js
```

**다음 세션 첫 작업 (순서 고정):**
1. `git status` — 위 3파일이 아직 미커밋인지 확인 (이미 커밋됐으면 skip)
2. 미커밋이면 → 커밋 + `git push origin main`
3. `npm run smoke -- https://www.profit-decision-engine.com` (프로덕션 smoke, 아직 **미실행**)
4. Stripe checkout E2E 수동 테스트 (로그인 → pricing → 결제 → Pro tier)

**아직 안 한 것 (중복 금지):**
- ❌ 프로덕션 smoke 미실행
- ❌ Stripe checkout E2E 수동 테스트 미실행
- ❌ TikTok Apify refresh 수동 테스트 미실행
- ❌ 이번 변경 커밋·push 미완료

---

## 0. 한 줄 요약

Amazon 셀러용 BUY / SKIP / RISK 의사결정 SaaS. Next.js 14 + TypeScript. Stripe·Resend·Supabase(Postgres)·Apify·Amazon SP-API 연동. **외부 서비스가 전부 죽어도 mock으로 응답**하는 방어적 아키텍처가 핵심.

**프로덕션:** https://www.profit-decision-engine.com — 전 서비스 `live`, health warnings 없음.

---

## 1. 완료된 작업 (1~10번)

| # | 작업 | 상태 | 핵심 변경 |
|---|------|------|-----------|
| 1 | Stripe webhook 멱등성 | ✅ | `tryClaimStripeEvent()` → `processed_stripe_events` INSERT ON CONFLICT |
| 2 | ScanPanel retail URL | ✅ | URL → `productUrl`, ASIN → `asin` |
| 3 | `upgradeUserToPro` 통합 | ✅ | `users.ts` 단일화, `upgrade.ts` / `upgrade-user.ts` 삭제 |
| 4 | README / health 동기화 | ✅ | DB-free auth 문서화, `authMode: "jwt-magic-link"` |
| 5 | `.env.example` | ✅ | 생성 + `.gitignore`에 `!.env.example` |
| 6 | Vercel 배포 설정 | ✅ | `vercel.json` (Next.js, `iad1`). Cron **미포함** |
| 7 | `git push origin main` | ✅ | `origin/main`과 동기화 완료 |
| 8 | Vercel 프로젝트 연결 | ✅ | `profit-engine1/profit-decision-engine`, 로컬 `vercel link` 완료 |
| 9 | 프로덕션 health 검증 | ✅ | db/stripe/email/apify 전부 `live`, warnings `[]` |
| 10 | E2E smoke test 스크립트 | ✅ | `scripts/smoke-test.js` + `npm run smoke` (5/5 통과) |

**커밋:** `90c3b88` — **7~10번 변경은 워킹 트리에만 있음, 아직 push 안 됨**

---

## 2. 빌드·테스트 검증

```bash
npm run build   # ✅ 2026-07-07 성공
npm run smoke   # ✅ 2026-07-07 로컬 5/5 통과
```

프로덕션 smoke (선택):
```bash
npm run smoke -- https://www.profit-decision-engine.com
```

---

## 3. 다음 우선순위

| 우선순위 | 작업 | 비고 |
|----------|------|------|
| **P0** | — | Costco retail URL fix **완료** (`a588fc6`) |
| P1 | 프로덕션 smoke | `npm run smoke -- https://www.profit-decision-engine.com` (**미실행**) |
| P2 | Stripe checkout E2E (수동) | 로그인 → pricing → checkout → webhook → Pro tier 확인 |
| P3 | TikTok Apify refresh (수동) | 대시보드 버튼 → 캐시 적재 확인 |
| P4 | (선택) Cron route 추가 | `CRON_SECRET` 보호 `/api/cron/*` + `vercel.json` crons |

---

## 4. Vercel 배포 현황

| 항목 | 값 |
|------|-----|
| Vercel 팀 | `profit-engine1` |
| 프로젝트 | `profit-decision-engine` |
| 프로덕션 URL | https://www.profit-decision-engine.com |
| Vercel alias | https://profit-decision-engine.vercel.app |
| 리전 | `iad1` |
| 최근 배포 | 2026-07-07, status **Ready** |
| 로컬 link | ✅ `.vercel/` (gitignored) |

### 환경변수 (프로덕션 health 기준 — 전부 live)

`.env.example` 항목이 Vercel에 설정된 것으로 확인됨 (health `warnings: []`).

수동 재확인: Vercel Dashboard → Project Settings → Environment Variables

### 배포·마이그레이션 재실행 시

```bash
# DB migration (Supabase production URL)
DATABASE_URL=postgresql://... npm run db:migrate

# Stripe webhook endpoint (이미 등록됐을 가능성 높음)
https://www.profit-decision-engine.com/api/stripe/webhook
```

`vercel.json`:
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
| DB migration | `scripts/migrate.js`, `migrations/*.sql` |
| E2E smoke test | `scripts/smoke-test.js` |
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

### Smoke test 커버리지 (`npm run smoke`)
1. `GET /api/health` — ok + services
2. `POST /api/scan` — verdict (BUY/SKIP/RISK)
3. `GET /api/tiktok/trending` — data array
4. `POST /api/stripe/checkout` unauth — 401
5. `POST /api/auth/request-link` — 200

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
| Apify, Stripe, Resend, Amazon SP-API | ✅ 코드 연동 + **프로덕션 live** |
| Supabase | ✅ Postgres 연결 live (health `db: "live"`) |
| Vercel | ✅ 배포 완료, 프로덕션 Ready |
| GitHub | ✅ `assetlabdigital-max/profit-decision-engine` |
| Cloudflare | 인프라 레벨 (도메인 alias 확인됨) |

---

## 9. 다음 세션 시작 프롬프트 (복붙용)

```
@README2.md 만 읽고 현재 상태 파악한 뒤 이어서 작업해 줘.
⚠️ 세션 중단점 섹션 확인 — 이미 완료된 작업 중복하지 말 것.
```

구체적 예:
```
README2.md 세션 중단점 보고 P0 커밋+push 해 줘
```
```
README2.md 보고 Stripe checkout E2E 가이드 써 줘
```

---

## 10. 알려진 트레이드오프

- `AUTH_SECRET` 미설정 → dev fallback (health warnings) — **프로덕션은 설정됨**
- DB outage 중 webhook → 멱등성 불가, best-effort
- JWT tier 항상 `free` — Pro는 DB만 신뢰
- Apify 수동 refresh만 — Cron 없음 (의도적)
- TikTok — Apify 스크래퍼 (ToS gray area)

---

## 12. 최근 버그 수정 — Retail URL → mock (RETAIL) 문제

**증상:** Costco/Walmart URL 스캔 시 `demo data`, ASIN `RETAIL`, Retail Arbitrage 없음.

**원인:**
1. Costco Apify에 `RESIDENTIAL` proxy 미설정
2. Costco `onlinePrice` fallback 미처리 (`memberPrice` null 시 파싱 실패)
3. Walmart/Target actor `dtrungtin~*` — Apify에서 404 (존재하지 않음)
4. URL query string (`?DM_PersistentCookieCreated=...`) 그대로 전달

**수정:** ✅ `a159e66` + follow-up (Costco search-first, Apify timeout param, Vercel maxDuration 120s)

**추가 수정 (2차):** ✅ `a588fc6` 배포 완료 — 프로덕션 재테스트 **성공** (2026-07-07)

**프로덕션 검증 결과:**
- `mock: false`, ASIN `B0D8YQK1VW`
- Retail Arbitrage: Costco **$24.99** vs Amazon **$35.75**
- 응답 시간 ~54초 (정상 — Apify search + Amazon match)

**배포 후 재테스트:**
```
Costco URL (query 제거됨 자동):
https://www.costco.com/p/-/super-nature-shampooconditioner-30-fl-oz-each/4000348787
```
기대: `demo data` 없음, **🛒 Retail Arbitrage** 섹션 표시.

**다음:** Walmart URL fix — `khadinakbar~walmart-data-extractor` itemIds 모드 ✅ `9937b06` 검증 완료

**Walmart 프로덕션 검증 (gaming chair URL):**
- `mock: false`, ASIN `B0H38CD82D`
- Retail Arbitrage: Walmart **$99.00**
- 응답 시간 ~2분 (itemIds Apify + Amazon match)
- ⚠️ Amazon 매칭 confidence `medium` — 다른 브랜드 chair에 매칭될 수 있음 (ASIN/제목 확인 권장)

**Retail match quality (2026-07-07):**
- `src/lib/retail/match-quality.ts` — store-exclusive brand 감지, title overlap scoring
- Amazon `$0` → `Unavailable`, misleading RISK/profit 숨김
- All in Motion 등 Target 전용 브랜드 → confidence `low` + 경고

---

| 파일 | 용도 |
|------|------|
| `README.md` | 공식 아키텍처·설정·보장 사항 |
| `README2.md` | **인수인계·작업 진행 상황** (이 파일) |
