# node-expat 제거 및 fast-xml-parser 교체 작업 기록

## 배경

Vercel 배포 시 `node-expat` 패키지가 네이티브 C 모듈(`nan` 라이브러리)에 의존하기 때문에
Node 18/20 환경에서 컴파일 오류가 발생하여 빌드가 실패한다.

```
node-expat → nan (네이티브 모듈) → Node 18/20 컴파일 실패
```

---

## 원인 분석

`node-expat`은 프로젝트에 직접 의존하지 않고, `xml2json` 패키지를 통해 간접 의존한다.

```
package.json
  └── xml2json@0.12.0
        └── node-expat (네이티브 모듈, C 컴파일 필요)
```

### 사용 위치

`xml2json`은 **단 한 곳**에서만 사용된다:

**`service/data.service.ts`** — Disqus XML 데이터를 import할 때

```
xml2json
  └── service/data.service.ts
        └── DataService.disqusAdapter(xmlData)     # XML → JSON 변환
        └── DataService.importFromDisqus(...)       # Disqus import 진입점
              └── pages/api/project/[projectId]/data/import.ts  # API 엔드포인트
```

### 핵심 기능 영향 없음

| 기능 | 영향 |
|---|---|
| 댓글 작성 | 없음 |
| 댓글 승인/관리 | 없음 |
| 댓글 표시 | 없음 |
| Disqus import | 영향 있음 (이 기능 자체가 XML 파싱 사용) |

---

## 해결 방법

`xml2json` → `fast-xml-parser`로 교체.

**선택 이유:**
- 순수 JavaScript (네이티브 모듈 없음)
- 주간 수백만 다운로드의 검증된 라이브러리
- 활발한 유지보수
- API가 단순하고 기존 코드 변경 최소화 가능

---

## 변경 파일

### 1. `package.json`

```diff
- "xml2json": "^0.12.0"
+ "fast-xml-parser": "^4.5.4"
```

### 2. `service/data.service.ts`

```diff
- const parser = require('xml2json')
+ import { XMLParser } from 'fast-xml-parser'
+ import TurndownService from 'turndown'
+ import { statService } from './stat.service'
+
+ const xmlParser = new XMLParser({
+   ignoreAttributes: false,
+   attributeNamePrefix: '',
+   isArray: (name) => name === 'thread' || name === 'post',
+ })
```

```diff
- const parsed = JSON.parse(parser.toJson(xmlData)).disqus
+ const parsed = xmlParser.parse(xmlData).disqus
```

### `XMLParser` 설정 설명

| 옵션 | 값 | 이유 |
|---|---|---|
| `ignoreAttributes` | `false` | `dsq:id` 같은 XML 속성을 파싱하기 위해 |
| `attributeNamePrefix` | `''` | 기존 코드의 `_['dsq:id']` 키 접근 방식 유지 |
| `isArray` | `thread \| post` | 1개뿐일 때도 배열로 처리 (xml2json 기본 동작 재현) |

---

## 설치 명령

```bash
npm remove xml2json --legacy-peer-deps
npm install fast-xml-parser --legacy-peer-deps
```

> `--legacy-peer-deps`는 프로젝트의 기존 peer dependency 충돌(`next-auth@3` + React 18) 때문에 필요한 플래그이며, 이번 변경과는 무관하다.

---

## 검증 포인트

Disqus XML export 파일을 이용해 아래 엔드포인트를 테스트하면 된다:

```
POST /api/project/{projectId}/data/import
Content-Type: multipart/form-data
Body: xml 파일 첨부
```

---

## PR 내용 (영문)

아래를 참고해 Cusdis 공식 레포에 PR을 올릴 수 있다.

---

### PR Title

```
fix: replace xml2json with fast-xml-parser to fix native module build failure on Node 18/20
```

### PR Body

```markdown
## Problem

Deploying Cusdis on platforms like Vercel fails because `xml2json` depends on
`node-expat`, a native C module that requires compilation via `nan`. This causes
build errors on Node 18 and Node 20.

**Dependency chain causing the issue:**
```
xml2json → node-expat → nan (native C module) → build failure
```

## Solution

Replace `xml2json` with [`fast-xml-parser`](https://github.com/NaturalIntelligence/fast-xml-parser),
a pure JavaScript XML parser with no native dependencies.

**Why `fast-xml-parser`:**
- Pure JavaScript — no native compilation required
- Millions of weekly downloads, actively maintained
- Minimal code change needed to replicate existing behavior

## Changes

- `package.json`: remove `xml2json`, add `fast-xml-parser@^4.5.4`
- `service/data.service.ts`: replace `xml2json` parser with `XMLParser` from `fast-xml-parser`

The `XMLParser` is configured to match the previous behavior exactly:
- `ignoreAttributes: false` — parses XML attributes like `dsq:id`
- `attributeNamePrefix: ''` — preserves existing key access patterns (e.g. `_['dsq:id']`)
- `isArray` for `thread` and `post` — ensures arrays even when there is only one element

## Scope

Only the Disqus import feature (`DataService.importFromDisqus`) is affected.
Core comment functionality (creating, approving, and displaying comments) is untouched.

## Testing

Import a Disqus XML export file via:
```
POST /api/project/{projectId}/data/import
```
and verify that threads and comments are imported correctly.
```
