## 복잡한 사고가 필요한 경우 sequentialthinking Tool 사용
- 예시
  - 복잡한 아키텍처 구성 시
  - 대규모 리펙터링 작업 시
  - 복잡한 원인 추적 시
  - 비즈니스 로직 및 알고리즘 검증 시
  - 그 외 복잡한 추론이 필요한 경우

## 적용 범위와 우선 원칙
- 이 저장소는 특정 제품의 단일 에이전트를 만드는 곳이 아니라, 나만의 AX FrameWork Plugin을 만드는 **Skill 생성소**다. 
또한 이 프레임워크는 프로젝트 단위로만 진행된다는 점 명심해라
이 파일의 규칙은 저장소 전체에
적용한다.

## 스킬의 컨텍스트 용량
 - 스킬의 컨텍스트에 들어갈 MD 파일의 라인수는 300라인 이하로 compact 하게 만든다.(setup 스킬은 제외한다)
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
