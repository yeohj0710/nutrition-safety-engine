// `server-only` 는 import 만 해도 던진다. 테스트에서 서버 모듈을 직접 부르려고
// 빈 모듈로 바꿔 둔다. vitest.config.ts 의 alias 가 이 파일을 가리킨다.
// 실제 빌드에는 들어가지 않으므로 클라이언트 번들 보호는 그대로다.
export {};
