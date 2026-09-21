# 하루알람

일정, 메모, 반복 알람을 한곳에서 관리하는 Android 중심의 일정 앱입니다. React와 Capacitor로 구성되며 Google 로그인, Supabase 동기화, Google Calendar 가져오기를 지원합니다.

## 앱 미리보기

### 오늘에 집중

시간순으로 오늘 일정을 확인하고 완료 여부와 알람 상태를 바로 관리합니다. 놓치면 안 되는 내용은 **중요 메모**로 화면 상단과 일정에 함께 강조됩니다.

![오늘 일정과 중요 메모 화면](store-screenshots/play-store-1080x1920/02-today.png)

### 계획하고, 알림 받기

| 월간 일정 | 알람 관리 |
| :---: | :---: |
| 날짜별 일정을 한눈에 확인 | 예정된 알람을 빠르게 켜고 끄기 |
| ![월간 캘린더 화면](store-screenshots/play-store-1080x1920/03-calendar.png) | ![알람 관리 화면](store-screenshots/play-store-1080x1920/04-alarms.png) |

### 시작부터 등록까지

| 간편 로그인 | 빠른 일정 등록 |
| :---: | :---: |
| Google 계정으로 내 일정 불러오기 | 중요 메모와 반복 알람까지 한 번에 설정 |
| ![Google 로그인 화면](store-screenshots/play-store-1080x1920/01-login.png) | ![새 일정 등록 화면](store-screenshots/play-store-1080x1920/05-add-schedule.png) |

## 주요 기능

- 일별 일정 등록, 수정, 완료, 삭제
- 월간 캘린더와 대한민국 공휴일 표시
- 매일, 평일, 매주 반복 알람
- Android 기본 시계 앱에 알람 추가
- 설정에서 소리 및 진동, 소리, 진동, 무음 방식 선택
- Google 계정별 일정 분리 및 Supabase 동기화
- Google Calendar의 향후 90일 일정 가져오기 및 최신 업데이트 시각 표시
- 월간 캘린더, 날짜별 알람, 알람 추가와 켜기·끄기를 제공하는 Android 홈 화면 위젯

새 일정의 사전 알림은 `정시`가 기본값입니다. 일정 등록 화면에서 필요한 경우에만 5분 전, 10분 전, 30분 전, 1시간 전으로 바꿀 수 있습니다.

## 개발 실행

```powershell
npm install
npm run dev
```

루트에 `.env` 파일을 만들고 다음 값을 설정해야 로그인과 클라우드 동기화를 사용할 수 있습니다.

```dotenv
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 검사 및 빌드

```powershell
npm run lint
npm run build
npm run android:release
```

서명된 APK는 `android/app/build/outputs/apk/release/app-release.apk`에 생성됩니다. 릴리스 빌드에는 Git에서 제외된 `android/keystore.properties`와 해당 키 저장소가 필요합니다.

## Android 위젯

앱을 한 번 실행해 일정을 불러온 다음 홈 화면을 길게 눌러 **위젯 > 하루알람**을 선택합니다. 로그인하지 않은 상태에서는 로그인 안내를 표시하며, 누르면 앱의 간편 로그인 화면이 열립니다. 로그인 후에는 왼쪽 월간 달력에서 날짜와 월을 이동하면 오른쪽에 해당 날짜의 알람이 최대 3개 표시됩니다. 추가 버튼은 선택한 날짜의 새 일정 화면을 열고, 알람 행이나 상태 버튼을 누르면 해당 월의 알람 관리 화면으로 이동합니다. 일정 추가, 수정, 완료 또는 알람 상태 변경 시 내용이 갱신됩니다.

## 시스템 시계 연동

일정의 알람을 저장하거나 활성화하면 Android `AlarmClock.ACTION_SET_ALARM`을 통해 기본 시계 앱에 알람을 추가합니다. 소리와 진동 방식은 앱의 **설정 > 알람 방식** 값을 사용합니다.

Android 표준 API는 생성한 시계 알람의 고유 ID를 반환하지 않으므로 앱에서 기존 시계 알람을 안정적으로 수정하거나 삭제할 수 없습니다. 설정을 바꾼 뒤 이미 생성된 알람은 시계 앱에서 직접 조정해야 하며, 제조사 시계 앱에 따라 일부 옵션이 다르게 처리될 수 있습니다.
