# Bonjour! 프랑스어 학습

한국어 사용자를 위한 프랑스어 학습 웹 앱입니다.

## 실행

`index.html`을 브라우저에서 열면 됩니다. 별도의 설치, 빌드, API 키가 필요하지 않습니다.

## Vercel 배포

- GitHub 저장소를 Vercel 프로젝트에 연결합니다.
- Framework Preset: Other
- Root Directory: 저장소 루트 (`./`)
- Build Command: 없음
- Output Directory: `.`

`vercel.json`에 정적 사이트 설정을 포함했습니다. 연결된 운영 브랜치에 변경 사항을 커밋하면 Vercel이 배포합니다.

## 파일

- `index.html`: 배포용 앱. 앞으로 앱 수정은 이 파일에 반영합니다.
- `불어학습앱.html`: 로컬 폴더에 보관한 최초 첨부 원본(배포 제외).

## 홈 화면 설치와 로그인

홈 화면 설치 배너, 기기별 설치 안내, 앱 아이콘과 manifest, 정적 학습 화면의 오프라인 캐시를 포함합니다. 로그인에는 인터넷 연결이 필요합니다.

Android에서는 설치 이벤트가 준비되면 다운로드 버튼에서 브라우저 설치 창을 직접 엽니다. 설치 이벤트가 아직 없을 때 메뉴 안내 팝업을 표시하지 않습니다. 앱 내 브라우저 등에서는 버튼을 누르면 Chrome으로 연결합니다. 브라우저가 설치 이벤트를 제공하지 않거나 이미 설치된 경우 사이트에서 설치 창을 강제로 띄울 수는 없습니다. 설치 코드는 인증 CDN보다 먼저 실행됩니다.

`config.js`의 `supabaseUrl`과 `supabasePublishableKey`에 Supabase 프로젝트 URL과 공개 publishable key(또는 legacy anon key)를 입력하세요. 비밀 키와 service_role 키는 넣지 마세요.

Supabase 대시보드의 Authentication에서 Email 공급자를 켜고 URL Configuration의 Site URL을 운영 사이트 주소로 지정하세요. Redirect URLs에도 운영 사이트 주소(`/` 포함)를 등록하세요. 이메일 인증을 사용하면 회원가입 후 받은 메일의 인증 링크로 돌아와 로그인할 수 있습니다. 비밀번호 정책은 프로젝트 설정에서 관리합니다.

공개 설정이 없으면 로그인 팝업에 준비 중 안내를 표시하고 입력을 비활성화합니다. 로그인 기능은 학습 기록의 서버 동기화를 포함하지 않습니다.

로컬 확인: `node scripts/serve.cjs` 실행 후 `http://127.0.0.1:4173` 접속.

검증: `node --test tests/app.test.cjs`

학습 기록은 현재 브라우저의 localStorage에 저장되며 다른 기기나 도메인으로 자동 이동하지 않습니다. 글꼴은 Google Fonts에서 불러옵니다.
