# 학습 후보 정제 Skill

`curate-learning-candidates`는 프로젝트에서 수집한 사용자 프롬프트와
최종 답변을 검토 가능한 학습 제안으로 변환하는 Skill이다.

이 Skill은 원본 데이터를 곧바로 Skill이나 메모리에 반영하는 자동학습
도구가 아니다. 수집, 정제, 검토, 승격을 서로 분리하고 사용자의 명시적
승인 전에는 실제 지침을 변경하지 않는다.

## 전체 흐름

1. 수집 훅이 `UserPromptSubmit`의 원문 프롬프트와 `Stop`의 최종 답변을
   turn 식별자로 결합한다.
2. 원본 쌍을 프로젝트의 `candidates.jsonl`에 `unreviewed` 상태로 저장한다.
3. 예약 실행이나 수동 실행으로 아직 처리하지 않은 후보만 정제한다.
4. 정제 과정에서 민감정보와 저품질 데이터를 제거하고, 유사 사례를
   합치며, 다른 작업에도 적용할 수 있는 규칙으로 일반화한다.
5. 결과를 실제 변경이 아닌 `proposed` 상태의 학습 제안으로 저장한다.
6. 사용자가 제안을 검토해 승인, 거절 또는 보류한다.
7. 승인된 제안만 대상 Skill, `AGENTS.md`, 프로젝트 참조 문서 등에
   반영하고 검증한다.

## Skill 실행 전 예약 확인

Windows에서는 이 Skill을 사용할 때 가장 먼저 프로젝트의 예약 작업을
확인하고, 없으면 등록한다.

```bash
node "<skill-dir>/scripts/manage-scheduler.mjs" ensure \
  --project "<project-root>"
```

`ensure`는 프로젝트 경로로 고유한 작업 이름을 만들고 Windows 작업
스케줄러를 먼저 조회한다. 이미 있으면 변경하지 않고, 없을 때만 새 작업을
등록한다. 따라서 Skill이 활성화될 때마다 선행 실행해도 중복 예약이
생기지 않는다.

기본 실행 시각은 매일 `02:00`이다. 처음 등록할 때 다른 시각을 사용하려면
`--time HH:mm`을 추가한다.

```bash
node "<skill-dir>/scripts/manage-scheduler.mjs" ensure \
  --project "<project-root>" \
  --time "03:30"
```

이미 등록된 예약에는 새 `--time` 값을 적용하거나 기존 설정을 덮어쓰지
않는다. 이 경우 결과의 `created`는 `false`이고 기존 구성을 그대로
유지한다.

예약 상태만 확인하려면 다음 명령을 사용한다.

```bash
node "<skill-dir>/scripts/manage-scheduler.mjs" status \
  --project "<project-root>"
```

결과가 `status: "registered"`인 경우에만 다음 정제 단계로 진행한다.
등록 실패 시 자동 정제가 활성화되었다고 간주하지 않는다. 프로젝트나
Skill의 위치를 옮겼다면 새 절대 경로가 반영되도록 예약을 다시 확인해야
한다.

## 수집 훅 구성

플러그인으로 제공할 때는 플러그인 루트의 `hooks/hooks.json`을 사용한다.
플러그인 없이 프로젝트에서만 사용할 때는
`<project-root>/.codex/hooks.json`을 사용한다.

두 설정을 동시에 활성화하면 동일한 turn이 중복 수집될 수 있으므로
한쪽만 사용해야 한다.

수집 훅은 다음 원칙을 지킨다.

- 훅 내부에서 LLM을 호출하지 않는다.
- 전체 transcript를 읽거나 저장하지 않는다.
- 사용자 프롬프트와 최종 답변만 저장한다.
- 시스템 및 개발자 지침, 숨겨진 추론, 도구 출력, 하위 에이전트 대화는
  저장하지 않는다.
- 오류가 발생해도 본 작업을 막지 않는 fail-open 방식으로 동작한다.
- 여러 `Stop` 훅이 답변을 이어갈 수 있으므로 최신 답변을 임시 파일에
  보관하고, 다음 `UserPromptSubmit` 또는 `SessionEnd`에서 후보를 확정한다.

## 예약 정제와 상태 게이트

예약 실행 전에 처리할 후보가 있는지 확인하려면 다음 명령을 사용한다.

```bash
node "<skill-dir>/scripts/run-curation.mjs" check \
  --project "<project-root>" \
  --require-work
```

종료 코드의 의미는 다음과 같다.

| 종료 코드 | 의미 |
| --- | --- |
| `0` | 처리하지 않은 후보가 있음 |
| `3` | 처리할 후보가 없음 |
| 그 외 | 상태 파일이 잘못되었거나 읽을 수 없어 실행을 중단해야 함 |

스케줄러는 종료 코드 `3`을 오류가 아닌 정상적인 무작업 결과로 처리해야
한다. `run` 명령 자체도 잠금을 획득한 뒤 상태를 다시 확인하므로,
스케줄러가 종료 코드 분기를 지원하지 않으면 `run`을 직접 호출해도 된다.

```bash
node "<skill-dir>/scripts/run-curation.mjs" run \
  --project "<project-root>"
```

처리할 후보가 없으면 Skill 목록을 읽거나 `codex exec`를 호출하지 않고
`status: "no-work"`로 끝난다. 처리할 후보가 있으면 읽기 전용 sandbox에서
구조화된 정제를 실행한다.

준비 여부를 나타내는 별도 플래그는 저장하지 않는다. 다음 상태 파일에
기록되지 않은 candidate ID가 존재하는지가 유일한 실행 기준이다.

```text
<project-root>/.jsfwork/learning/curation/state.json
```

## 제안 검토

현재 제안을 확인한다.

```bash
node "<skill-dir>/scripts/run-curation.mjs" list \
  --project "<project-root>"
```

모든 이력을 포함하려면 `--all`을 추가한다.

각 제안에는 다음 내용이 포함된다.

- 다른 작업에도 적용할 수 있는 일반화된 규칙
- 규칙이 적용되는 상황
- 반복 가능한 작업 절차
- 피해야 할 실패 방식
- 고유 근거 수와 원본 candidate ID
- 권장 반영 대상
- 기존 지침과의 충돌 가능성
- 추가 검증 필요 여부와 검증 방법

제안이 생성됐다는 사실은 승인을 의미하지 않는다.

## 승인·거절·보류

승인된 제안을 실제 대상에 반영하고 검증한 뒤 상태를 기록한다.

```bash
node "<skill-dir>/scripts/run-curation.mjs" review \
  --project "<project-root>" \
  --proposal "<proposal-id>" \
  --status approved \
  --target-updated \
  --note "<반영 내용과 검증 결과>"
```

거절하거나 추가 근거가 필요하면 대상을 변경하지 않고 상태만 기록한다.

```bash
node "<skill-dir>/scripts/run-curation.mjs" review \
  --project "<project-root>" \
  --proposal "<proposal-id>" \
  --status rejected \
  --note "<거절 사유>"
```

`--status deferred`를 사용하면 결정을 보류할 수 있다.

상태의 의미는 다음과 같다.

| 상태 | 의미 |
| --- | --- |
| `proposed` | 검토 대기 중이며 실제 대상은 변경되지 않음 |
| `approved` | 사용자가 승인했고 대상 반영과 검증까지 완료됨 |
| `rejected` | 승격하지 않기로 결정함 |
| `deferred` | 추가 근거나 나중의 결정이 필요함 |

## 학습자료 분류

| 후보 종류 | 권장 위치 |
| --- | --- |
| 반복 가능한 작업 절차 | 기존 Skill 또는 새로운 Skill |
| 저장소의 안정적인 규칙 | `AGENTS.md` 또는 프로젝트 참조 문서 |
| 개인 선호와 작업 방식 | 사용자 메모리 제안, 자동 기록 금지 |
| 버전·경로·일회성 오류 등 임시 사실 | 폐기, 보류 또는 작업 기록 |

명시적인 사용자 규칙은 사례가 한 건이어도 승인 후보가 될 수 있다.
일반적인 추론 규칙은 보통 독립적인 사례가 두세 건 필요하다. 새로운
Skill을 제안하려면 기존 Skill과 구분되는 트리거와 반복적인 활용 가능성이
있어야 한다.

## 승격 원칙

- 최종 답변을 짧게 요약하는 데 그치지 않고 재사용 가능한 규칙으로
  일반화한다.
- 같은 의미와 적용 조건을 가진 후보만 결합한다.
- 가능한 경우 새 Skill보다 기존 Skill 보완을 우선한다.
- 버전이나 외부 정책에 따라 바뀔 수 있는 주장은 최신 1차 문서로
  검증하기 전에는 승격하지 않는다.
- 핵심 규칙은 `SKILL.md`, 상세 사례는 `references/`, 반복적이고
  결정적인 처리는 `scripts/*.mjs`에 둔다.
- 예약 정제 과정에서는 Skill, `AGENTS.md`, 프로젝트 문서, 사용자
  메모리를 직접 수정하지 않는다.

## 주요 파일

| 파일 | 역할 |
| --- | --- |
| `SKILL.md` | Codex가 따르는 핵심 정제·검토·승격 절차 |
| `scripts/manage-scheduler.mjs` | Windows 예약 상태 확인과 누락된 일일 정제 작업 등록 |
| `scripts/run-curation.mjs` | 상태 확인, 배치 생성, 정제 실행, 제안 조회 및 리뷰 상태 관리 |
| `scripts/self-test.mjs` | 결정적 상태 관리와 주요 명령의 자체 테스트 |
| `scripts/scheduler-self-test.mjs` | 예약 이름, 명령 구성, 멱등 등록의 자체 테스트 |
| `scripts/integration-test.mjs` | 실제 구성 요소를 연결한 통합 검증 |
| `references/promotion-policy.md` | 분류, 근거, 일반화 및 승격 정책 |
| `references/curation-output.schema.json` | 정제 결과의 구조화된 출력 형식 |
| `agents/openai.yaml` | Skill 목록에 표시되는 이름과 기본 프롬프트 |

에이전트가 실제로 따라야 하는 권위 있는 지침은 `SKILL.md`이며, 이
README는 사용자가 구조와 운영 방법을 빠르게 이해하기 위한 요약 문서다.
