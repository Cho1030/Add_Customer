# 알바 가용 일정 보드

지원자 목록과 근무 가능 날짜를 달력으로 함께 보는 정적 웹앱입니다.

## 기능

- 지원자 목록 확인
- 월별 달력에서 근무 가능 날짜 표시
- 새 지원자 추가
- 지원자 수정/삭제
- 근무 가능 날짜 수동 추가
- 특정 지원자를 선택한 뒤 달력 날짜를 클릭해서 가능일 빠른 추가/삭제
- 브라우저 `localStorage` 자동 저장

## 실행 방법

`index.html` 파일을 브라우저에서 열면 바로 사용할 수 있습니다.

로컬 서버로 보고 싶다면 예시:

```powershell
cd "C:\Users\user\OneDrive\문서\New project\alba-scheduler"
python -m http.server 8080
```

그 뒤 브라우저에서 `http://localhost:8080` 으로 접속하면 됩니다.

## GitHub 업로드용 구조

- `index.html`
- `styles.css`
- `app.js`
- `README.md`

별도 빌드가 필요 없는 구조라서 깃허브 저장소에 그대로 올려두고 나중에 파일만 수정하면 됩니다.
