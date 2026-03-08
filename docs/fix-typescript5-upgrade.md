# TypeScript 5 업그레이드 및 Vercel 빌드 오류 수정 기록

## 배경

`node-expat` 제거를 위해 `xml2json` → `fast-xml-parser` 교체 후에도 Vercel 빌드가 계속
실패했다. 원인은 TypeScript 버전 불일치와 그로 인한 연쇄 타입 오류들이었다.

---

## 문제 1: `yarn.lock` 손상

### 원인
`npm install`로 패키지를 설치하면서 `npm`과 `yarn`이 혼용됨.
`yarn.lock`이 `node_modules`와 불일치 상태가 됨.

### 해결
```bash
rm yarn.lock
npx yarn install   # yarn.lock 재생성
```

### 추가 조치
`package-lock.json`이 로컬에 생성되어 있었음.
Vercel이 `package-lock.json`을 보고 npm으로 설치를 시도할 수 있으므로 삭제 + `.gitignore`에 추가.

```diff
# .gitignore
+ package-lock.json
```

---

## 문제 2: `react-hook-form`의 `const` 타입 파라미터 오류

### 오류
```
Type error in watch.d.ts: 'const' type parameter requires TypeScript 5.0+
```

### 원인
- `"react-hook-form": "^7.1.1"` — 캐럿으로 인해 yarn이 최신 7.x(7.43+)로 해석
- react-hook-form 7.43부터 `const` 타입 파라미터 문법 사용
- `const` 타입 파라미터는 **TypeScript 5.0**에서 도입
- 기존 `"typescript": "^4.8.2"`로는 파싱 불가

### 해결: TypeScript `^5.0.0`으로 업그레이드

```diff
# package.json devDependencies
- "typescript": "^4.8.2"
+ "typescript": "^5.0.0"
```

react-hook-form을 구버전으로 핀하는 대신 TypeScript를 올린 이유:
- TS 5.0은 2023년 4월 출시, Next.js 13과 완전 호환
- react-hook-form을 구버전으로 고정하면 보안/버그픽스 누락 위험
- yarn.lock에 의해 Vercel도 동일 버전(5.9.3) 사용이 보장됨

---

## 문제 3: `Buffer`가 `BinaryLike`에 할당 불가 오류

### 오류
```
./pages/api/subscription.ts:30:44
Type error: Argument of type 'Buffer' is not assignable to parameter of type 'BinaryLike'.
  Type 'Buffer' is not assignable to type 'Uint8Array<ArrayBufferLike> | DataView<ArrayBufferLike>'.
    Type 'Buffer' is not assignable to type 'Uint8Array<ArrayBufferLike>'.
      The types returned by 'slice(...).entries()' are incompatible between these types.
        Type 'IterableIterator<[number, number]>' is missing the following properties
        from type 'ArrayIterator<[number, number]>': map, filter, take, drop, and 9 more.
```

### 원인
TypeScript 5.6+에서 iterator 타입이 엄격해짐:
- 기존: `IterableIterator<T>`
- 신규: `ArrayIterator<T>` (추가 메서드 포함)

`@types/node@14.x`의 `Buffer` 정의가 이 변경을 반영하지 않아 `BinaryLike` 타입과 충돌.

### 해결: `@types/node`를 실제 런타임(Node 20)에 맞게 업그레이드

```diff
# package.json devDependencies
- "@types/node": "^14.14.21"
+ "@types/node": "^20.0.0"
```

yarn.lock에 `@types/node@20.19.37`로 고정됨.

---

## 문제 4, 5: 빈 `<NextHead>` 컴포넌트 타입 오류 (2곳)

### 오류
```
Type error: Property 'children' is missing in type '{}' but required in type '{ children: ReactNode; }'.
```

### 원인
TypeScript 5.x + `@types/react@18`에서 `next/head`의 `Head` 컴포넌트가
`children`을 필수로 요구하게 됨.

아래 두 파일에서 `<NextHead>`가 실제 children 없이 사용됨:

**`pages/index.tsx`**
```jsx
<NextHead>
  {/* <link rel="preconnect" href="https://fonts.gstatic.com" />
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:..." rel="stylesheet" /> */}
</NextHead>
```
JSX 주석은 children으로 인정되지 않아 TypeScript가 `{}` (no props)로 처리함.

**`pages/privacy-policy.tsx`**
```jsx
<NextHead>
</NextHead>
```
완전히 빈 상태.

### 해결: 두 블록 모두 제거 + 관련 import 제거

두 `<NextHead>` 블록이 실제로 불필요한 죽은 코드였음을 확인:
- `index.tsx`: Google Fonts(Montserrat) 링크가 주석 처리. `style.css`에 `.font { font-family: 'Montserrat' }` 정의가 있으나 `className="font"`를 사용하는 컴포넌트가 전혀 없음 → 사실상 미사용 코드
- `privacy-policy.tsx`: 아무 내용도 없는 빈 태그

```diff
# pages/index.tsx
- import NextHead from 'next/head'
- <NextHead>
-   {/* <link rel="preconnect" href="https://fonts.gstatic.com" />
-   <link href="...Montserrat..." rel="stylesheet" /> */}
- </NextHead>

# pages/privacy-policy.tsx
- import NextHead from 'next/head'
- <NextHead>
- </NextHead>
```

---

## 최종 결과

```
✓ Compiled successfully
✓ Generating static pages (2/2)
✓ Build Completed
```

Vercel 빌드 성공 확인 (커밋 `805b988`).

---

## 커밋 이력

| 커밋 | 내용 |
|---|---|
| `a052786` | fix: xml2json → fast-xml-parser |
| `4415b22` | chore: yarn.lock 재생성 |
| `1696eb4` | chore: package-lock.json gitignore 추가 |
| `74579fb` | fix: TypeScript ^4.8.2 → ^5.0.0 |
| `cae846e` | fix: @types/node ^14 → ^20 |
| `538b12f` | fix: index.tsx 빈 NextHead 및 Montserrat 죽은 코드 제거 |
| `805b988` | fix: privacy-policy.tsx 빈 NextHead 제거 |

---

## PR 내용 (영문)

아래 내용으로 djyde/cusdis에 PR을 올릴 수 있다.

### PR Title

```
fix: resolve Vercel/Node 20 build failures (native module, TypeScript 5 compatibility)
```

### PR Body

```markdown
## Problem

Deploying Cusdis on Vercel (Node 18/20) fails due to several compounding issues:

1. `xml2json` depends on `node-expat`, a native C module that cannot be compiled on Node 18/20
2. TypeScript 4.x cannot parse `const` type parameters introduced in `react-hook-form` 7.43+
3. `@types/node@14.x` Buffer type definitions are incompatible with TypeScript 5.6+'s stricter iterator types
4. Two empty `<NextHead>` blocks cause type errors under the updated type definitions

## Changes

### 1. Replace `xml2json` with `fast-xml-parser`

`xml2json` pulls in `node-expat` (native C via `nan`), which fails to compile on Node 18/20.
Replaced with `fast-xml-parser`, a pure JavaScript alternative.

Only the Disqus import feature (`DataService.importFromDisqus`) is affected.
Core comment functionality is untouched.

```diff
- "xml2json": "^0.12.0"
+ "fast-xml-parser": "^4.5.4"
```

The `XMLParser` is configured to preserve existing behavior:
- `ignoreAttributes: false` — parses XML attributes like `dsq:id`
- `attributeNamePrefix: ''` — preserves existing key access patterns
- `isArray` for `thread` and `post` — ensures arrays even with a single element

### 2. Upgrade TypeScript to `^5.0.0`

`react-hook-form` 7.43+ uses `const` type parameters, which require TypeScript 5.0+.
Upgrading TypeScript is preferred over pinning react-hook-form to an older version.

```diff
- "typescript": "^4.8.2"
+ "typescript": "^5.0.0"
```

### 3. Upgrade `@types/node` to `^20.0.0`

TypeScript 5.6+ introduced stricter iterator types (`ArrayIterator` vs `IterableIterator`).
The old `@types/node@14.x` `Buffer` definition is incompatible, causing a type error in
`pages/api/subscription.ts`. Upgrading to `@types/node@20` aligns type definitions with
the actual Vercel runtime.

```diff
- "@types/node": "^14.14.21"
+ "@types/node": "^20.0.0"
```

### 4. Remove empty `<NextHead>` blocks

Two files contained `<NextHead>` with no real children, which causes a TypeScript error
under the updated type definitions (`children` is now required).

Both blocks were confirmed to be dead code:
- `pages/index.tsx`: contained only a commented-out Google Fonts link for Montserrat.
  The `.font` CSS class referencing Montserrat is defined in `style.css` but never
  applied to any component.
- `pages/privacy-policy.tsx`: completely empty.

## Testing

- Vercel build passes successfully (all pages compiled, widget built)
- Disqus import: `POST /api/project/{projectId}/data/import` with a Disqus XML export file
- Core comment flow: create → approve → display
```
