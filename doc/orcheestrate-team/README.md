# JSFWORK 개발 메모

> 상태: 개발 중 · 갱신일: 2026-07-29 · 대상: JSFWORK Skill/플러그인 유지보수자

이 문서는 `orcheestrate-team`, `setup`, 단일 `explore` 에이전트를
기준으로 Codex의 Skill 발견 경로, 협업 도구의 현재 의미, 플러그인 설정의
경계를 정리한다. 도구
이름이나 동작을 장기 계약으로 고정하지 않으며, 실제 실행 환경의 도구 설명과
상위 지침을 우선한다.

JSFWORK의 설치·배포 식별자는 `jswork`, 사용자 표시명은 `JSFWORK`다.
`orcheestrate-team`은 플러그인명과 분리된 Skill 식별자다. 앞으로 추가되는
Skill, MCP 서버, 앱, 지원 자산은 이 플러그인 아래에서 독립적인 기능 단위로
확장한다.

## 저장소 구조

```text
plugin-root/
├── .codex/
│   ├── config.toml
│   └── agents/
│       ├── explore.toml
│       ├── orcheestrate-team-pl.toml
│       ├── orcheestrate-team-developer.toml
│       └── orcheestrate-team-qa.toml
├── .codex-plugin/
│   └── plugin.json
├── .mcp.json
├── global_config.toml
├── init-script/
│   ├── init_codex.py
│   └── templates/codex/
└── skills/
    ├── setup/
    └── orcheestrate-team/
```

- `.codex/config.toml`: 이 저장소를 열어 개발할 때만 적용하는 최소 Codex 설정
- `.codex-plugin/plugin.json`: JSFWORK 플러그인 엔트리포인트
- `.mcp.json`: 플러그인이 제공하는 MCP 서버 선언
- `global_config.toml`: 개인 전역 설정의 참고용 스냅샷. 저장소 루트에서는
  Codex 설정으로 로드되지 않는다.
- `.codex/agents/`: 이 저장소에서 사용할 `explore` 및 팀 역할 custom agent 프로필
- `init-script/`: 다른 프로젝트에 로컬 설정과 `explore`·팀 역할 프로필을 설치하는
  미리보기 우선 initializer
- `skills/`: 서로 독립적으로 선택할 수 있는 배포 Skill 원본

개인 모델, 승인, sandbox, UI, 설치된 플러그인 설정은
`.codex/config.toml`로 복사하지 않는다. 플러그인 MCP도 프로젝트 설정에
중복 등록하지 않는다. 이렇게 해야 사용자 전역 정책과 플러그인 의존성이
서로 덮어쓰거나 같은 MCP 서버를 두 번 등록하는 일을 피할 수 있다.

플러그인 manifest는 설치 대상 프로젝트의 Codex 설정이나 custom agent
프로필을 복사하지 않는다. 다른 저장소에서 이 플러그인을 사용할 때는 사용자
전역 설정이 아니라 프로젝트에서 `$jswork:setup`을 실행한다. 터미널에서 직접
초기화할 때는 플러그인 원본 루트에서 다음 명령을 사용한다.

```powershell
python .\init-script\init_codex.py --target C:\path\to\repository
python .\init-script\init_codex.py --target C:\path\to\repository --apply
```

첫 명령은 변경을 미리보기만 한다. 두 번째 명령도 대상 프로젝트의
`.codex/config.toml`과 `.codex/agents/`만 변경하며 전역 초기화는 지원하지 않는다.

현재는 저장소 루트 전체를 플러그인 원본으로 사용하므로 로컬 설치 캐시에
`global_config.toml`도 참고 파일로 복사될 수 있다. Codex 런타임 설정으로
적용되지는 않지만, 외부 배포 전에 개인 경로와 환경 정보가 든 참고 파일을
배포 대상에서 제외하거나 공개 가능한 예제로 정리해야 한다.

## Skill 발견 경로

Codex가 사용할 수 있는 대표적인 Skill 범위는 다음과 같다.

| 범위 | 위치 | 용도 |
| --- | --- | --- |
| 저장소 | 저장소 루트까지의 각 `.agents/skills/` | 프로젝트와 함께 버전 관리하는 Skill |
| 사용자 | `$HOME/.agents/skills/` | 여러 저장소에서 공통으로 쓰는 Skill |
| 관리자 | `/etc/codex/skills/` | 관리자가 배포하는 시스템 범위 Skill |
| 플러그인 | 플러그인 manifest가 가리키는 `skills/` | 설치된 플러그인이 제공하는 Skill |

이 저장소는 플러그인 방식으로 배포하므로
`.codex-plugin/plugin.json`의 `"skills": "./skills/"`가
`orcheestrate-team`과 `setup`을 각각 독립적인 Skill로 발견 경로에
올린다. `explore`는 Skill이 아니라 프로젝트 custom agent 프로필이다.

각 Skill 디렉터리에는 `SKILL.md`가 필요하다. 디렉터리명과 frontmatter의
`name`을 일치시키고, `agents/openai.yaml`에는 표시 이름과 기본 프롬프트
같은 UI 메타데이터만 둔다. 사용자는 `$jswork:orcheestrate-team`과
`$jswork:setup`을 명시적으로 선택할 수 있고, Codex는 frontmatter의 설명과
요청이 충분히 일치할 때 암시적으로 선택할 수도 있다.

## 플러그인과 MCP

Codex의 엔트리포인트는 `.codex-plugin/plugin.json`이다.
`mcpServers`는 루트의 `.mcp.json`을 가리킨다.

현재 MCP 구성은 Windows 개발 환경에서 `cmd /c npx`로
`@modelcontextprotocol/server-sequential-thinking`의 고정 버전을 실행한다.
고정 버전은 설치 시점에 따라 동작이 바뀌는 것을 줄인다. 다른 운영체제에
배포할 때는 `command`를 해당 환경에 맞는 교차 플랫폼 launcher로 바꿔야 한다.

MCP 등록은 도구를 사용할 수 있게 할 뿐, 모든 요청에서 그 도구를 강제로
호출하지 않는다. 복잡한 아키텍처, 원인 추적, 알고리즘 검증처럼 실제로
추론 보조가 필요한 경우에만 사용한다.

## 협업 도구 의미론

아래 의미는 현재 세션의 도구 설명을 요약한 것이다. Skill은 이 동작을
활용하되 별도 프로토콜이나 영구 계약으로 확대하지 않는다.

| 도구 | 현재 의미 |
| --- | --- |
| `spawn_agent` | 하위 에이전트를 만들고 첫 작업을 즉시 시작한다. |
| `send_message` | 기존 에이전트에 정보를 전달하며 새 작업 턴을 강제로 시작하지 않는다. |
| `followup_task` | 기존 에이전트에 후속 작업을 전달하고, 유휴 상태라면 작업 턴을 시작한다. |
| `wait_agent` | 살아 있는 에이전트의 mailbox 갱신을 기다린다. |
| `list_agents` | 현재 에이전트 트리와 상태를 조회한다. |
| `interrupt_agent` | 대상의 현재 턴을 중단하지만 에이전트 자체는 남겨 둔다. |

팀 역할 프로필은 다음과 같이 고정한다. PM은 이 Skill을 호출한 현재 주
에이전트이므로 별도 프로필을 만들지 않는다.

대량 파일과 내용을 파악할 때는 단일 `explore` 프로필을 사용한다. 이
프로필은 `gpt-5.3-codex-spark`, 낮은 추론 강도를 요청하며, Codex memory를
사용하지 않는다. 호출자가 지정한 요약본 원문 파일 하나만 새로 만들 수 있고
그 밖의 쓰기는 금지된다. 한 세션으로 범위를 감당하기 어려우면 main thread가
동일한 프로필의 여러 세션으로 범위를 분할한다.

| 역할 | custom agent 프로필 | 모델 | 추론 강도 | 기본 sandbox |
| --- | --- | --- | --- | --- |
| PL | `orcheestrate-team-pl` | `gpt-5.4` | `high` | `read-only` |
| Developer 1 | `orcheestrate-team-developer` | `gpt-5.3-codex-spark` | `medium` | `workspace-write` |
| Developer 2 | `orcheestrate-team-developer` | `gpt-5.3-codex-spark` | `medium` | `workspace-write` |
| QA | `orcheestrate-team-qa` | `gpt-5.4` | `high` | `read-only` |

custom agent 프로필은 재사용 가능한 역할 설정 계층이며, 팀 구성원의 실행
식별자 자체가 아니다. 오케스트레이터는 동일한 developer 프로필로 두 세션을
각각 생성하고, 각 세션의 초기 프롬프트와 안정적인 작업명에서 Developer 1
또는 Developer 2라는 실행 식별자를 부여한다. 따라서 공용 프로필에는 특정
developer 번호를 고정하지 않는다.

각 역할 TOML은 전체 Skill 본문이 세션에 상속된다고 가정하지 않아도 해당
역할을 수행할 수 있도록 역할 행동, 경계, 보고 항목을 자체적으로 설명한다.
`orcheestrate-team` Skill은 다섯 명의 팀 구성, 작업 배정, 역할 간 조정과
검토 흐름을 담당한다.

호스트가 custom profile 선택자를 제공하면 해당 프로필을 직접 선택한다.
모델과 추론 강도만 지정할 수 있는 실행 환경에서는 그 두 값을 명시하고 역할
프롬프트를 함께 전달하되, 프로필의 sandbox까지 적용됐다고 기록하지 않는다.
사용자가 선택한 현재 세션 권한 모드가 프로필보다 우선할 수 있다.

`orcheestrate-team`은 PM, PL, Developer 1, Developer 2, QA의 역할과
책임 경계를 자연어로 유지한다. Task DAG는 의존성과 담당을 보여 주는
가벼운 협업 메모이며, JSON 메시지 스키마, 상태 머신, queue, lease 또는
평가·학습 루프로 승격하지 않는다.

## 검증과 로컬 설치

저장소 루트에서 다음 검증을 실행한다.

```powershell
Get-ChildItem skills -Directory | ForEach-Object {
    python C:\Users\junsu\.codex\skills\.system\skill-creator\scripts\quick_validate.py $_.FullName
}
python -m unittest discover -s init-script/tests -v
python C:\Users\junsu\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py .
```

개인 marketplace는 `$HOME/.agents/plugins/marketplace.json`을 사용하고,
로컬 플러그인 원본은 `$HOME/plugins/jswork`에서 찾는다.
개발 원본을 이 저장소에 유지하려면 그 위치에 저장소 루트를 가리키는
심볼릭 링크나 Windows directory junction을 둔다. marketplace 항목을
만든 뒤에는 다음 명령으로 설치한다.

```powershell
codex plugin add jswork@jswork
```

설치 캐시는 원본 변경을 자동 반영한다고 가정하지 않는다. manifest나 Skill을
수정한 뒤에는 플러그인 개발용 cachebuster/update 절차로 다시 설치하고,
새 Codex 세션에서 `$jswork:orcheestrate-team`, `$jswork:setup`, `explore` custom
agent 프로필, 팀 custom agent 프로필, MCP 도구 노출을 각각 확인한다.
