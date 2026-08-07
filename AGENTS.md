## Sequential Thinking MCP 사용
- `.codex/config.toml`의 `[mcp_servers.sequential-thinking]` 서버는 복잡한 추론을 구조화할 때 사용한다.
- 다음 중 하나 이상에 해당하고 일반적인 분석만으로 판단 근거를 명확히 유지하기 어려울 때 `sequentialthinking` Tool을 사용한다.
  - 복수의 가설이나 설계안을 비교하거나 반례를 검증해야 하는 경우
  - 분석 도중 전제, 범위, 접근 방식을 수정할 가능성이 큰 경우
  - 여러 단계의 상태, 의존성, 의사결정을 추적해야 하는 경우
  - 복잡한 원인 추적, 아키텍처 설계, 대규모 리팩터링, 비즈니스 로직이나 알고리즘 검증
- 단순 조회, 명확한 단일 파일 수정, 형식 변경처럼 사고 분기나 가설 검증이 불필요한 작업에는 사용하지 않는다.
- 필요한 만큼만 사고 단계를 사용하고 결론과 검증 근거가 확보되면 종료한다.
- MCP Tool이 노출되지 않거나 시작 또는 호출에 실패하면 그 제약을 보고하고, 동일한 가설·검증 구조의 수동 분석으로 계속 진행한다. 실패를 숨기거나 Tool을 사용한 것으로 보고하지 않는다.
- Tool의 내부 사고 과정을 그대로 최종 답변에 노출하지 않고 결론, 근거, 미해결 사항만 간결하게 보고한다.

## 적용 범위와 우선 원칙
- 이 저장소는 특정 제품의 단일 에이전트를 만드는 곳이 아니라, 나만의 AX FrameWork Plugin을 만드는 **Skill 생성소**다. 
또한 이 프레임워크는 프로젝트 단위로만 진행된다는 점 명심해라
이 파일의 규칙은 저장소 전체에
적용한다.

## 스킬의 컨텍스트 용량
 - 스킬의 컨텍스트에 들어갈 MD 파일의 라인수는 200라인 이하로 compact 하게 만든다. (setup Skill은 예외로 한다)
- 초과 시 인덱싱을 통해 분할하되 컨텍스트는 최소 필수 단위로 만든다.
- 즉 MVP 위주로 설계 한다.

## Script 사용 시 주의 사항
 - 스킬 생성 시에는 MD 및 PROMPT 주입 위주로 진행
 - 스크립트 생성 시에는 워크 플로우 및 계약 강제와 같은 부분은 사용하지 않는다.
 - 스크립트는 컨텍스트 절감 및 라우팅 및 기타 기능만 제공한다

## 스킬 제작 후 항상 검증을한다.
 - 스킬의 제작 시 자신에게 관대하지마라
 - 작성 시 항상 결합 여부를 확인하고 수정해야한다.
 - 수정 사항이 발생할 경우 사용자의 의도대로 진행하고 수정바향에 대해서 사용자의 의도를 파악하지 못한다면 질의를 한다. 질의는 항상 선택형으로 진행하되 마지막 선택형은 서술 제출형으로 진행한다.
 - 설치된 플러그인은 점검하지 말것
 - 최종 작성 후 리뷰를 진행하여 보고한다.
 - 최종 보고는 결함 사항, 미 해결 사항 기타 등을 보고해야한다.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
