AI 노래 생성 템플릿 (Suno 스타일)
=================================

개요
----
이 폴더에는 AI 음악 생성(예: Suno)용 샘플 스크립트가 들어 있습니다. 실제 AI 서비스 엔드포인트와 API 키를 넣어 실행하면 `assets/songs/` 폴더에 생성된 wav/mp3 파일을 저장합니다. 생성된 파일은 게임의 `songData`에 등록하거나, `selectedSong.audio`에 파일 경로를 넣으면 게임에서 재생되고 자동으로 비트맵이 생성됩니다.

중요
-----
- 이 템플릿은 'Suno-like' API 응답을 가정합니다: JSON에 `audio_base64` 또는 `audio_url`을 반환해야 합니다. 실제 사용 시에는 서비스 문서를 참고하여 `API_URL`을 적절히 설정하세요.
- API 키는 환경변수 `SUNO_API_KEY`(또는 `AI_SONG_KEY`)로 전달해야 합니다.

파일
----
- `scripts/generate_suno.js`: Node.js 템플릿. `axios`와 `minimist`가 필요합니다.
- `scripts/run_generate_suno.ps1`: Windows PowerShell에서 쉽게 실행하는 래퍼.

설치(로컬)
----------------
1. Node.js 설치(없다면): https://nodejs.org
2. 프로젝트 루트에서 의존성 설치:

```powershell
cd c:\김연준\2D프로그래밍\BangDream
npm install axios minimist
```

사용 예
------
PowerShell 예:

```powershell
$env:SUNO_API_KEY = 'your-real-api-key'
.\scripts\run_generate_suno.ps1 -Prompt 'Energetic electronic track for rhythm game' -Bpm 140 -Duration 20 -Out 'ai_demo_1.wav'
```

직접 Node 실행:

```powershell
node scripts/generate_suno.js --prompt "Chiptune-styled beat" --bpm 150 --duration 18 --out demo_chiptune.wav
```

실행 결과
---------
- 성공하면 `assets/songs/demo_chiptune.wav` 같은 파일이 생성됩니다.
- 생성된 파일을 게임에서 사용하려면 `songData`에 `{ id:'ai1', name:'AI Demo', audio:'assets/songs/demo_chiptune.wav', bpm:150 }` 처럼 추가하세요.

서비스 호환성
--------------
- Suno: 음악(비트/멜로디) 생성에 강한 서비스로, 템플릿의 기본 가정에 잘 맞습니다.
- Uberduck: 보컬/싱잉 합성에 강합니다. 반주(백킹 트랙)는 Suno로, 보컬은 Uberduck으로 분리해서 생성한 뒤 믹스하면 좋습니다.

다음 단계 제안
----------------
1. 원하시면 Uberduck 통합 템플릿(보컬 합성)도 추가해 드립니다.
2. 자동으로 Suno(반주) + Uberduck(보컬)를 호출하고 두 음원을 합쳐 `assets/songs/merged.wav`로 만드는 스크립트도 만들어 드릴 수 있습니다.
