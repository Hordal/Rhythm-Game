AI 곡 생성 파이프라인

요약
- 이 프로젝트는 로컬에서 AI 음악(예: Suno)과 보컬(예: Uberduck)을 생성하고 ffmpeg로 믹스하여 `assets/songs/`에 저장하고 `manifest.json`을 갱신하는 스크립트를 제공합니다.

필수 도구
- Node.js 18+ (global `node` 사용)
- ffmpeg (PATH에 추가)
- API 키: Suno(또는 대체 음악 생성 API)용 `SUNO_API_KEY`, Uberduck(또는 대체 보컬 API)용 `UBERDUCK_API_KEY` 및 `UBERDUCK_API_SECRET`

설치
1. 프로젝트 루트에서 npm 의존성 설치:

```bash
npm install
```

실행 예
- PowerShell (Windows):

```powershell
# 환경 변수 설정 (예)
$env:SUNO_API_KEY = "your_suno_key"
$env:UBERDUCK_API_KEY = "your_uberduck_key"
$env:UBERDUCK_API_SECRET = "your_uberduck_secret"

# 한 번에 생성
.\scripts\generate_all.ps1 -Prompt "upbeat trance" -Lyrics "we light the night" -Voice ryan -OutBase demo01 -Bpm 140 -Duration 24
```

- 또는 Node로 직접:

```bash
node scripts/generate_all.js --prompt "upbeat trance" --lyrics "we light the night" --voice ryan --out demo01 --bpm 140 --duration 24
```

결과
- `assets/songs/`에 `demo01_inst.wav`, `demo01_vocal.wav`, `demo01_merged.wav` 등이 생성됩니다.
- 믹스 결과는 `assets/songs/manifest.json`에 자동으로 항목이 추가됩니다.

주의
- 제공된 Node 템플릿은 실제 서비스의 API 형식(요청/응답)을 가정한 예시입니다. 서비스에 따라 엔드포인트 및 응답 키(`audio_base64` 또는 `audio_url`)를 조정해야 합니다.
- API 사용에는 요금이 발생할 수 있습니다. 키를 안전하게 관리하세요.

문의
- 스크립트 맞춤(예: ElevenLabs 지원, 음성/톤 파라미터 추가, 자동 파라미터 튜닝)이 필요하면 알려주세요.
