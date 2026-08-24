# pydantic-deep API reference

Extracted from the installed pydantic-deep package. Regenerate with `just api-ref`.

## Building an agent

### `create_deep_agent`

```python
def create_deep_agent(
    model: str | Model | None = None,
    fallback_model: str | Model | list[str | Model] | None = None,
    model_settings: dict[str, Any] | None = None,
    summarization_model: str | None = None,
    instructions: str | None = None,
    output_style: str | OutputStyle | None = None,
    styles_dir: str | list[str] | None = None,
    tools: Sequence[Tool[DeepAgentDeps] | Any] | None = None,
    toolsets: Sequence[AbstractToolset[DeepAgentDeps]] | None = None,
    extra_toolsets: Sequence[AbstractToolset[Any]] | None = None,
    mcp_servers: Sequence[AbstractToolset[Any]] | None = None,
    capabilities: Sequence[AbstractCapability[Any]] | None = None,
    subagents: list[SubAgentConfig] | None = None,
    skill_directories: list[dict[str, Any]] | list[str] | list[BackendSkillsDirectory] | None = None,
    skills: list[Skill] | None = None,
    backend: BackendProtocol | None = None,
    include_todo: bool = True,
    include_current_todos: bool = False,
    include_filesystem: bool = True,
    include_subagents: bool = True,
    include_skills: bool = True,
    include_builtin_subagents: bool = True,
    include_plan: bool = True,
    max_nesting_depth: int = 1,
    subagent_registry: DynamicAgentRegistry | None = None,
    subagent_extra_toolsets: Sequence[AbstractToolset[Any]] | None = None,
    subagent_usage_limits: UsageLimits | UsageLimitsFactory | None = None,
    subagent_ask_timeout_seconds: float = 60.0,
    include_execute: bool | None = None,
    interrupt_on: dict[str, bool] | None = None,
    output_type: OutputSpec[OutputDataT] | None = None,
    history_processors: Sequence[HistoryProcessor[DeepAgentDeps]] | None = None,
    eviction_token_limit: int | None = 20000,
    max_binary_content: int | None = 3,
    edit_format: str = 'hashline',
    context_manager: bool = True,
    context_manager_max_tokens: int | None = None,
    on_context_update: Any | None = None,
    on_before_compress: Any | None = None,
    on_after_compress: Any | None = None,
    on_eviction: Any | None = None,
    context_files: list[str] | None = None,
    context_discovery: bool = False,
    include_memory: bool = True,
    memory_dir: str | None = None,
    retries: int = 3,
    hooks: list[Any] | None = None,
    patch_tool_calls: bool = True,
    include_checkpoints: bool = False,
    checkpoint_frequency: CheckpointFrequency = 'every_tool',
    max_checkpoints: int = 20,
    checkpoint_store: CheckpointStore | None = None,
    include_teams: bool = False,
    include_monitoring: bool = True,
    include_improve: bool = False,
    include_liteparse: bool = False,
    stuck_loop_detection: bool = True,
    periodic_reminder: PeriodicReminderConfig | bool | None = None,
    web_search: bool = True,
    web_fetch: bool = True,
    thinking: bool | str = 'high',
    include_history_archive: bool = True,
    history_messages_path: str = '.pydantic-deep/messages.json',
    cost_tracking: bool = True,
    cost_budget_usd: float | None = None,
    on_cost_update: Any | None = None,
    middleware: Sequence[Any] | None = None,
    plans_dir: str | None = None,
    message_queue: MessageQueue | None = None,
    forking: bool | LiveForkCapability = False,
    tool_search: bool = False,
    instrument: bool | None = None,
    agent_kwargs: Any,
)
```

Create a deep agent with planning, filesystem, subagent, and skills capabilities.

### `create_default_deps`

```python
def create_default_deps(
    backend: BackendProtocol | None = None,
)
```

Create default dependencies for a deep agent.

## Types the builder takes

### `Hook`

```python
    event: HookEvent
    command: str | None
    handler: Callable[[HookInput], Awaitable[HookResult]] | None
    matcher: str | None
    timeout: int
    background: bool
```

A hook definition that fires on tool lifecycle events.

### `OutputStyle`

```python
    name: str
    description: str
    content: str
```

An output style that controls agent tone and response format.

### `Skill`

```python
    name: str
    description: str
    content: str
    license: str | None
    compatibility: str | None
    resources: list[SkillResource]
    scripts: list[SkillScript]
    uri: str | None
    metadata: dict[str, Any] | None
```

A skill instance with metadata, content, resources, and scripts.

### `RuntimeConfig`

```python
    name: <class 'str'>
    description: <class 'str'>
    image: str | None
    base_image: str | None
    packages: list[str]
    package_manager: Literal['pip', 'npm', 'apt', 'cargo']
    setup_commands: list[str]
    env_vars: dict[str, str]
    work_dir: <class 'str'>
    cache_image: <class 'bool'>
    run_as_uid: int | None
```

Configuration for a Docker runtime environment.

### `TeamMemberSpec`

```python
    name: <class 'str'>
    role: <class 'str'>
    description: <class 'str'>
    instructions: <class 'str'>
    model: <class 'str'>
```

A team member supplied to the `spawn_team` tool.

### `SubAgentConfig`

```python
    name: str
    description: str
    instructions: str
    model: NotRequired[str | Model]
    agent: NotRequired[Any]
    agent_factory: NotRequired[Callable[..., Any]]
    can_ask_questions: NotRequired[bool]
    max_questions: NotRequired[int]
    preferred_mode: NotRequired[Literal['sync', 'async', 'auto']]
    typical_complexity: NotRequired[Literal['simple', 'moderate', 'complex']]
    typically_needs_context: NotRequired[bool]
    toolsets: NotRequired[Sequence[AbstractToolset[Any]]]
    agent_kwargs: NotRequired[dict[str, Any]]
    context_files: NotRequired[list[str]]
    extra: NotRequired[dict[str, Any]]
    max_retries: NotRequired[int]
    retry_initial_delay: NotRequired[float]
    retry_max_delay: NotRequired[float]
    retry_backoff_multiplier: NotRequired[float]
    retry_jitter: NotRequired[bool]
    retry_on: NotRequired[Callable[[BaseException], bool]]
    on_failure: NotRequired[str]
    contain_errors: NotRequired[bool]
```

Configuration for a subagent.

## Enumerations and constants

### `HookEvent`

```python
    HookEvent.PRE_TOOL_USE  # 'pre_tool_use'
    HookEvent.POST_TOOL_USE  # 'post_tool_use'
    HookEvent.POST_TOOL_USE_FAILURE  # 'post_tool_use_failure'
    HookEvent.BEFORE_RUN  # 'before_run'
    HookEvent.AFTER_RUN  # 'after_run'
    HookEvent.RUN_ERROR  # 'run_error'
    HookEvent.BEFORE_MODEL_REQUEST  # 'before_model_request'
    HookEvent.AFTER_MODEL_REQUEST  # 'after_model_request'
    HookEvent.MODEL_FALLBACK_TRIGGERED  # 'model_fallback_triggered'
```

`BASE_PROMPT` is the harness's own tool-usage instructions. Compose with it rather than replacing it:

```python
instructions=f"{BASE_PROMPT}\n\n{your_instructions}"
```

## Backends

`LocalBackend()` runs filesystem and execute tools on the host. `DockerSandbox` isolates them. Execute tools stay off unless `include_execute=True`.
