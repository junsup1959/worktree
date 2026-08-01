# JSFWORK

JSFWORK는 Codex에서 프로젝트 단위의 AX 워크플로를 구성하기 위한 플러그인입니다. 팀 기반 구현 오케스트레이션, 프로젝트 초기화, 대규모 소스 탐색, BDD 및 학습 후보 정리용 Skill을 하나의 플러그인으로 제공합니다.

## 플러그인 구성

- 플러그인 이름: `jsfwork`
- 현재 버전: `0.1.0+codex.20260728161304`
- 플러그인 매니페스트: `.codex-plugin/plugin.json`
- Skill: `skills/`
- MCP 설정: `.mcp.json`
- GitHub: <https://github.com/junsup1959/worktree>

## GitHub 저장소를 Codex Plugin Marketplace로 사용하기

이 방식은 GitHub 저장소를 개인 또는 팀용 Git marketplace로 등록하는 방법입니다. OpenAI의 universal public plugin directory에 공개 심사를 요청하는 절차와는 다릅니다.

### 1. Marketplace 카탈로그 추가

Codex가 이 저장소를 marketplace로 인식하려면 저장소에 다음 파일이 있어야 합니다.

```text
.agents/plugins/marketplace.json
```

현재 플러그인은 GitHub 저장소 루트에 있으므로 다음 내용으로 파일을 만듭니다.

```json
{
  "name": "jsfwork",
  "interface": {
    "displayName": "JSFWORK Marketplace"
  },
  "plugins": [
    {
      "name": "jsfwork",
      "source": {
        "source": "url",
        "url": "https://github.com/junsup1959/worktree.git",
        "ref": "master"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

파일을 추가한 뒤 `master` 브랜치에 커밋하고 GitHub로 push합니다. 기본 브랜치를 변경했다면 JSON의 `ref`와 아래 명령의 `--ref`도 같은 브랜치 이름으로 변경합니다.

> 현재 저장소에는 `.codex-plugin/plugin.json`은 있지만 `.agents/plugins/marketplace.json`은 아직 없습니다. 아래 설치 명령은 marketplace 카탈로그를 커밋하고 push한 뒤 사용해야 합니다.

### 2. Marketplace 등록

Codex CLI가 설치된 PC에서 다음 명령을 실행합니다.

```powershell
codex plugin marketplace add junsup1959/worktree --ref main
```

등록 결과를 확인합니다.

```powershell
codex plugin marketplace list
```

### 3. JSFWORK 플러그인 설치

```powershell
codex plugin add jsfwork@jsfwork
```

설치 결과를 확인합니다.

```powershell
codex plugin list
```

Codex CLI에서는 `/plugins`를 입력해 플러그인 브라우저에서도 설치 상태를 확인할 수 있습니다. 설치 후에는 새 Codex 세션을 시작해야 플러그인에 포함된 Skill과 도구가 새 세션에 반영됩니다.

### PowerShell 실행 정책 오류가 발생할 때

`codex.ps1` 실행이 차단되면 Windows의 `codex.cmd`를 직접 호출합니다.

```powershell
& "$env:APPDATA\npm\codex.cmd" plugin marketplace add junsup1959/worktree --ref master
& "$env:APPDATA\npm\codex.cmd" plugin add jsfwork@jsfwork
```

### Marketplace 업데이트

GitHub에 새 버전을 push한 뒤 marketplace snapshot을 갱신합니다.

```powershell
codex plugin marketplace upgrade jsfwork
```

설치된 플러그인을 확실히 새로 반영하려면 제거 후 다시 설치하고 새 Codex 세션을 시작합니다.

```powershell
codex plugin remove jsfwork@jsfwork
codex plugin add jsfwork@jsfwork
```

### 제거

```powershell
codex plugin remove jsfwork@jsfwork
codex plugin marketplace remove jsfwork
```

## 참고

- [OpenAI 공식 Plugin 패키징 및 Marketplace 문서](https://developers.openai.com/plugins/build/plugins)
- [OpenAI Plugin 아키텍처](https://developers.openai.com/plugins/concepts/plugins)

