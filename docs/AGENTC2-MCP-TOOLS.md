# AgentC2 MCP — Tool Catalog

> **222 tools** across platform utilities, named agents, networks, workflows, and third-party integrations.

---

## Platform Utilities

Core tools for managing the AgentC2 platform — agents, networks, workflows, knowledge, infrastructure, and observability.

### Agent CRUD & Management

| Tool                   | Description                                |
| ---------------------- | ------------------------------------------ |
| `agent_create`         | Create a new agent                         |
| `agent_read`           | Read agent configuration                   |
| `agent_update`         | Update agent configuration                 |
| `agent_delete`         | Delete an agent                            |
| `agent_list`           | List all agents                            |
| `agent_discover`       | Discover available agents and capabilities |
| `agent_overview`       | Get agent overview / summary               |
| `agent_invoke_dynamic` | Dynamically invoke any agent by slug       |
| `agent_versions_list`  | List agent version history                 |
| `agent_costs`          | View agent cost breakdown                  |
| `agent_analytics`      | View agent analytics and usage             |

### Agent Runs

| Tool               | Description                    |
| ------------------ | ------------------------------ |
| `agent_runs_list`  | List agent runs with filtering |
| `agent_runs_get`   | Get details of a specific run  |
| `agent_run_cancel` | Cancel a running agent         |
| `agent_run_rerun`  | Re-run a previous agent run    |
| `agent_run_trace`  | Get full trace for a run       |

### Agent Evaluations & Testing

| Tool                      | Description                      |
| ------------------------- | -------------------------------- |
| `agent_evaluations_list`  | List evaluation results          |
| `agent_evaluations_run`   | Run evaluations against an agent |
| `agent_scorers_list`      | List available scoring metrics   |
| `agent_test_cases_list`   | List test cases for an agent     |
| `agent_test_cases_create` | Create a new test case           |
| `agent_simulations_list`  | List agent simulations           |
| `agent_simulations_get`   | Get simulation details           |
| `agent_simulations_start` | Start a new simulation           |
| `agent_feedback_list`     | List user feedback               |
| `agent_feedback_submit`   | Submit feedback on a run         |

### Agent Learning (Self-Improvement)

| Tool                              | Description                  |
| --------------------------------- | ---------------------------- |
| `agent_learning_start`            | Start a learning session     |
| `agent_learning_sessions`         | List learning sessions       |
| `agent_learning_session_get`      | Get learning session details |
| `agent_learning_metrics`          | View learning metrics        |
| `agent_learning_experiments`      | View active experiments      |
| `agent_learning_policy`           | Get learning policy          |
| `agent_learning_policy_update`    | Update learning policy       |
| `agent_learning_proposal_approve` | Approve a learning proposal  |
| `agent_learning_proposal_reject`  | Reject a learning proposal   |

### Agent Guardrails

| Tool                      | Description                   |
| ------------------------- | ----------------------------- |
| `agent_guardrails_get`    | Get guardrails for an agent   |
| `agent_guardrails_update` | Update agent guardrails       |
| `agent_guardrails_events` | View guardrail trigger events |
| `org_guardrails_get`      | Get org-level guardrails      |
| `org_guardrails_update`   | Update org-level guardrails   |

### Agent Budget

| Tool                  | Description                    |
| --------------------- | ------------------------------ |
| `agent_budget_get`    | Get budget policy for an agent |
| `agent_budget_update` | Update budget policy           |

### Skills

| Tool                    | Description                     |
| ----------------------- | ------------------------------- |
| `skill_create`          | Create a new skill              |
| `skill_read`            | Read skill configuration        |
| `skill_update`          | Update a skill                  |
| `skill_delete`          | Delete a skill                  |
| `skill_list`            | List all skills                 |
| `skill_get_versions`    | List skill version history      |
| `skill_attach_tool`     | Attach a tool to a skill        |
| `skill_detach_tool`     | Detach a tool from a skill      |
| `skill_attach_document` | Attach a document to a skill    |
| `skill_detach_document` | Detach a document from a skill  |
| `agent_attach_skill`    | Attach a skill to an agent      |
| `agent_detach_skill`    | Detach a skill from an agent    |
| `agent_skill_update`    | Update an agent's skill binding |

### Agent Output Actions

| Tool                         | Description                      |
| ---------------------------- | -------------------------------- |
| `agent_output_actions_list`  | List output actions for an agent |
| `agent_output_action_create` | Create a new output action       |
| `agent_output_action_update` | Update an output action          |
| `agent_output_action_delete` | Delete an output action          |
| `agent_output_action_test`   | Test an output action            |

### Agent Schedules

| Tool                    | Description            |
| ----------------------- | ---------------------- |
| `agent_schedule_list`   | List scheduled runs    |
| `agent_schedule_create` | Create a scheduled run |
| `agent_schedule_update` | Update a scheduled run |
| `agent_schedule_delete` | Delete a scheduled run |

### Triggers

| Tool                            | Description                 |
| ------------------------------- | --------------------------- |
| `agent_trigger_list`            | List agent triggers         |
| `agent_trigger_create`          | Create a trigger            |
| `agent_trigger_update`          | Update a trigger            |
| `agent_trigger_delete`          | Delete a trigger            |
| `agent_trigger_execute`         | Manually fire a trigger     |
| `agent_trigger_test`            | Test a trigger              |
| `agent_trigger_unified_list`    | List unified triggers       |
| `agent_trigger_unified_get`     | Get unified trigger details |
| `agent_trigger_unified_create`  | Create a unified trigger    |
| `agent_trigger_unified_update`  | Update a unified trigger    |
| `agent_trigger_unified_delete`  | Delete a unified trigger    |
| `agent_trigger_unified_enable`  | Enable a unified trigger    |
| `agent_trigger_unified_disable` | Disable a unified trigger   |
| `trigger_events_list`           | List trigger event history  |
| `trigger_events_get`            | Get trigger event details   |

### Networks

| Tool                    | Description                       |
| ----------------------- | --------------------------------- |
| `network_create`        | Create a new network              |
| `network_read`          | Read network configuration        |
| `network_update`        | Update a network                  |
| `network_delete`        | Delete a network                  |
| `network_execute`       | Execute a network                 |
| `network_generate`      | AI-generate a network definition  |
| `network_validate`      | Validate network configuration    |
| `network_list_runs`     | List network runs                 |
| `network_get_run`       | Get network run details           |
| `network_metrics`       | View network metrics              |
| `network_stats`         | View network statistics           |
| `network_versions`      | List network version history      |
| `network_designer_chat` | Chat with the network designer AI |

### Workflows

| Tool                     | Description                        |
| ------------------------ | ---------------------------------- |
| `workflow_create`        | Create a new workflow              |
| `workflow_read`          | Read workflow configuration        |
| `workflow_update`        | Update a workflow                  |
| `workflow_delete`        | Delete a workflow                  |
| `workflow_execute`       | Execute a workflow                 |
| `workflow_resume`        | Resume a suspended workflow        |
| `workflow_generate`      | AI-generate a workflow definition  |
| `workflow_validate`      | Validate workflow configuration    |
| `workflow_list_runs`     | List workflow runs                 |
| `workflow_get_run`       | Get workflow run details           |
| `workflow_metrics`       | View workflow metrics              |
| `workflow_stats`         | View workflow statistics           |
| `workflow_versions`      | List workflow version history      |
| `workflow_designer_chat` | Chat with the workflow designer AI |

### RAG / Knowledge Base

| Tool                  | Description                             |
| --------------------- | --------------------------------------- |
| `rag_ingest`          | Ingest a document into the vector store |
| `rag_query`           | Semantic search over ingested knowledge |
| `rag_documents_list`  | List ingested documents                 |
| `rag_document_delete` | Delete an ingested document             |

### Documents

| Tool              | Description       |
| ----------------- | ----------------- |
| `document_create` | Create a document |
| `document_read`   | Read a document   |
| `document_update` | Update a document |
| `document_delete` | Delete a document |
| `document_list`   | List documents    |
| `document_search` | Search documents  |

### Campaigns

| Tool              | Description          |
| ----------------- | -------------------- |
| `campaign_create` | Create a campaign    |
| `campaign_get`    | Get campaign details |
| `campaign_update` | Update a campaign    |
| `campaign_delete` | Delete a campaign    |
| `campaign_list`   | List campaigns       |

### Goals

| Tool          | Description      |
| ------------- | ---------------- |
| `goal_create` | Create a goal    |
| `goal_get`    | Get goal details |
| `goal_update` | Update a goal    |
| `goal_delete` | Delete a goal    |
| `goal_list`   | List goals       |

### Backlog

| Tool                    | Description               |
| ----------------------- | ------------------------- |
| `backlog_get`           | Get backlog details       |
| `backlog_list_tasks`    | List backlog tasks        |
| `backlog_add_task`      | Add a task to the backlog |
| `backlog_update_task`   | Update a backlog task     |
| `backlog_complete_task` | Mark a task complete      |

### Agent Instances (Slack Binding)

| Tool                      | Description                         |
| ------------------------- | ----------------------------------- |
| `instance_create`         | Create an agent instance            |
| `instance_get`            | Get instance details                |
| `instance_update`         | Update an instance                  |
| `instance_delete`         | Delete an instance                  |
| `instance_list`           | List all instances                  |
| `instance_bind_channel`   | Bind an instance to a Slack channel |
| `instance_unbind_channel` | Unbind an instance from a channel   |

### Integration Connections

| Tool                            | Description                              |
| ------------------------------- | ---------------------------------------- |
| `integration_connections_list`  | List integration connections             |
| `integration_connection_create` | Create a connection                      |
| `integration_connection_update` | Update a connection                      |
| `integration_connection_delete` | Delete a connection                      |
| `integration_connection_test`   | Test a connection                        |
| `integration_providers_list`    | List available providers                 |
| `integration_mcp_config`        | Get MCP configuration for an integration |

### Organizations

| Tool                   | Description              |
| ---------------------- | ------------------------ |
| `org_get`              | Get organization details |
| `org_list`             | List organizations       |
| `org_member_add`       | Add a member to an org   |
| `org_members_list`     | List org members         |
| `org_workspace_create` | Create a workspace       |
| `org_workspaces_list`  | List workspaces          |

### Live Monitoring & Observability

| Tool              | Description                            |
| ----------------- | -------------------------------------- |
| `live_metrics`    | Get aggregate live performance metrics |
| `live_runs`       | View currently running agents          |
| `live_stats`      | Platform-wide live statistics          |
| `audit_logs_list` | Query audit logs                       |

### Infrastructure & Compute

| Tool                   | Description                                 |
| ---------------------- | ------------------------------------------- |
| `provision_compute`    | Provision an ephemeral DigitalOcean Droplet |
| `teardown_compute`     | Tear down a provisioned droplet             |
| `destroy_resource`     | Destroy a tracked resource                  |
| `list_resources`       | List provisioned resources                  |
| `track_resource`       | Track a resource                            |
| `remote_execute`       | Execute a command on a droplet via SSH      |
| `remote_file_transfer` | Transfer files to/from a droplet            |
| `execute_code`         | Execute code in a Docker-isolated sandbox   |

### Workspace Files

| Tool                   | Description                 |
| ---------------------- | --------------------------- |
| `list_workspace_files` | List files in the workspace |
| `read_workspace_file`  | Read a workspace file       |
| `write_workspace_file` | Write a workspace file      |

### Cursor IDE Integration

| Tool                      | Description                 |
| ------------------------- | --------------------------- |
| `cursor_launch_agent`     | Launch a Cursor Cloud Agent |
| `cursor_get_status`       | Check agent status          |
| `cursor_get_conversation` | Get agent conversation      |
| `cursor_add_followup`     | Add a follow-up message     |
| `cursor_poll_until_done`  | Poll until agent completes  |

### DevOps / CI Pipeline

| Tool                       | Description                                         |
| -------------------------- | --------------------------------------------------- |
| `dispatch_coding_pipeline` | Dispatch a ticket to the autonomous coding pipeline |
| `lookup_pipeline_config`   | Look up pipeline configuration                      |
| `verify_branch`            | Verify a git branch                                 |
| `wait_for_checks`          | Wait for CI checks to pass                          |

### Support / Tickets

| Tool                    | Description             |
| ----------------------- | ----------------------- |
| `submit_support_ticket` | Submit a support ticket |
| `list_my_tickets`       | List your tickets       |
| `view_ticket_details`   | View ticket details     |
| `ingest_ticket`         | Ingest a ticket         |
| `comment_on_ticket`     | Comment on a ticket     |

### Platform Docs

| Tool            | Description                                              |
| --------------- | -------------------------------------------------------- |
| `platform_docs` | Get structured documentation about platform capabilities |

---

## Third-Party Agents (External Tools)

Named agents that wrap external services and integrations. These agents use MCP servers or native OAuth to interact with third-party platforms.

### CRM — HubSpot

| Tool                             | Description                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `agent_crm_specialist`           | Focused HubSpot CRM agent — contacts, companies, deals, pipeline, properties, engagements                          |
| `agent_hubspot_outbound_emailer` | Hourly agent that analyzes HubSpot CRM, enriches contacts, drafts personalized outbound emails, and posts to Slack |

### Project Management — Jira

| Tool                    | Description                                                                   |
| ----------------------- | ----------------------------------------------------------------------------- |
| `agent_jira_specialist` | Focused Jira agent — issues, sprints, projects, comments, transitions, boards |

### Communication — Slack

| Tool                      | Description                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `agent_slack_specialist`  | Focused Slack agent — channel messaging, user lookups, search, thread replies                |
| `agent_slack_hello_world` | Reusable Slack messaging agent other agents can call to send messages to any user or channel |
| `instance_bigjim2_slack`  | Big Jim II bound to Slack — network-first meta-agent accessed via Slack                      |

### Communication — Email (Gmail)

| Tool                       | Description                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `agent_email_triage`       | Classifies emails into 8 categories, enriches with CRM/Jira/Calendar/Fathom/Slack context, drafts responses |
| `agent_nate_email_triage`  | Email triage for Nate Friesen — classifies, enriches, and briefs                                            |
| `agent_nate_email_drafter` | Processes unread emails in Nate's inbox, drafts replies, sends Slack DM notifications                       |

### Communication — Calendar (Google)

| Tool                          | Description                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `agent_google_calendar_agent` | Google Calendar management — availability, scheduling, conflicts, daily overviews |
| `agent_calendar_assistant`    | Calendar assistant — checks availability, schedules meetings, finds conflicts     |

### Source Control — GitHub

| Tool                      | Description                                                               |
| ------------------------- | ------------------------------------------------------------------------- |
| `agent_github_specialist` | Focused GitHub agent — repos, issues, PRs, code search, branches, Actions |

### File Storage — Google Drive

| Tool                       | Description                                                            |
| -------------------------- | ---------------------------------------------------------------------- |
| `agent_google_drive_agent` | Google Drive management — file search, list, read (Docs/Sheets/Slides) |

### Meeting Intelligence — Fathom

| Tool                             | Description                                                                                  |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| `agent_fathom_ingester`          | Paginates through all Fathom meetings and ingests summaries into RAG (cost-optimized)        |
| `agent_fathom_meeting_processor` | Processes Fathom webhooks — fetches transcript/summary, synthesizes digest, ingests into RAG |
| `agent_meeting_analyst`          | RAG-powered meeting intelligence — queries embedded meeting knowledge base                   |

### Web Scraping — Firecrawl / Playwright

| Tool                           | Description                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `agent_web_scraper_specialist` | Focused web scraping agent via Firecrawl — scrapes pages, crawls websites, extracts structured content |
| `agent_browser_agent`          | Autonomous web agent combining Playwright browser automation, Firecrawl scraping, and code execution   |

### Web Search — Brave / Exa / Perplexity

| Tool                  | Description                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `smart_search`        | Intelligent search — auto-routes to best provider (Exa, Brave, Perplexity, or Firecrawl) |
| `brave_search`        | Fast web search via Brave Search (sub-second latency)                                    |
| `brave_news_search`   | News search via Brave                                                                    |
| `brave_local_search`  | Local business search via Brave                                                          |
| `exa_search`          | Neural search via Exa (95% factual accuracy)                                             |
| `exa_research`        | Deep research via Exa                                                                    |
| `exa_find_similar`    | Find similar content via Exa                                                             |
| `exa_get_contents`    | Get page contents via Exa                                                                |
| `perplexity_search`   | Quick search with AI-synthesized answer and citations                                    |
| `perplexity_research` | Deep research via Perplexity                                                             |

### YouTube

| Tool                     | Description                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `agent_youtube_research` | YouTube research analyst — extracts transcripts, discovers videos, analyzes content, builds knowledge base |

### Platform Operations

| Tool                      | Description                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `agent_platform_ops`      | Monitors agent health, runs, costs, metrics, and audit logs                                 |
| `agent_integration_scout` | Autonomous integration verification — systematically tests every integration in the catalog |

---

## Named Composite Agents

Higher-level agents that orchestrate multiple specialists or serve specific personas.

| Tool                         | Description                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `agent_bigjim2`              | Network-first meta-agent — delegates to specialist agents via networks         |
| `agent_briefing_synthesizer` | Generates the daily 6 AM standup briefing by delegating to 5 specialist agents |
| `agent_standup_orchestrator` | Generates the morning standup dashboard from Jira, Slack, and Fathom data      |
| `agent_welcome_v2`           | Public-facing welcome agent — positions AgentC2 as a platform                  |
| `agent_appello_assistant`    | Full-capability AI assistant for the Appello construction platform             |
| `agent_nathan_assistant`     | Nathan's personal AI assistant with connected integrations                     |
| `agent_travis_assistant`     | Travis's personal AI assistant with connected integrations                     |

---

## Named Networks

Pre-built agent networks that route queries to the right specialist.

| Tool                          | Description                                                        |
| ----------------------------- | ------------------------------------------------------------------ |
| `network_biz_ops`             | Routes to CRM, Jira, or Fathom specialists                         |
| `network_comms`               | Routes to email, Slack, or calendar specialists                    |
| `network_customer_operations` | Routes to email, calendar, or CRM/project specialists              |
| `network_engineering`         | Routes to GitHub, code search, PRs, and CI/CD                      |
| `network_morning_briefing`    | Morning briefing network                                           |
| `network_platform_admin`      | Routes to observability, dashboards, or skill composition          |
| `network_research_intel`      | Routes to web scraping, YouTube, web research, or general research |

---

## Named Workflows

Pre-built multi-step workflows.

| Tool                        | Description                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `workflow_daily_briefing`   | Morning briefing combining unread emails + today's calendar, posted to Slack            |
| `workflow_meeting_followup` | Processes Fathom meetings — extracts action items, creates Jira tickets, posts to Slack |
