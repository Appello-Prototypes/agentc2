-- V&V Database Reset Script
-- Deletes ALL data except Organization, Workspace, User, Membership, and auth tables.
-- Run with: psql $DATABASE_URL -f scripts/vv-reset-db.sql

BEGIN;

-- Level 1: Leaf nodes
DELETE FROM agent_trace_step;
DELETE FROM agent_tool_call;
DELETE FROM workflow_run_step;
DELETE FROM network_run_step;
DELETE FROM email_message;
DELETE FROM bim_element_property;
DELETE FROM bim_geometry_summary;

-- Level 2: Depend on leaf nodes
DELETE FROM agent_trace;
DELETE FROM email_thread;
DELETE FROM bim_element;

-- Level 2b: Runs
DELETE FROM agent_run;
DELETE FROM workflow_run;
DELETE FROM network_run;

-- Level 3: Agent sub-entities
DELETE FROM agent_tool;
DELETE FROM agent_version;
DELETE FROM agent_schedule;
DELETE FROM agent_trigger;
DELETE FROM agent_alert;
DELETE FROM agent_evaluation;
DELETE FROM agent_feedback;
DELETE FROM agent_test_case;
DELETE FROM agent_test_run;
DELETE FROM agent_conversation;
DELETE FROM budget_policy;
DELETE FROM cost_event;
DELETE FROM agent_cost_daily;
DELETE FROM agent_model_cost_daily;
DELETE FROM cost_recommendation;
DELETE FROM guardrail_policy;
DELETE FROM guardrail_event;
DELETE FROM agent_stats_daily;
DELETE FROM agent_metric_daily;
DELETE FROM agent_tool_metric_daily;
DELETE FROM agent_model_metric_daily;
DELETE FROM agent_quality_metric_daily;
DELETE FROM agent_feedback_aggregate_daily;
DELETE FROM agent_version_stats;
DELETE FROM evaluation_theme;
DELETE FROM insight;
DELETE FROM trigger_event;
DELETE FROM gmail_integration;

-- Level 3b: Learning system
DELETE FROM learning_approval;
DELETE FROM learning_experiment;
DELETE FROM learning_proposal;
DELETE FROM learning_signal;
DELETE FROM learning_dataset;
DELETE FROM learning_session;
DELETE FROM learning_policy;
DELETE FROM learning_metric_daily;
DELETE FROM simulation_session;

-- Level 3c: Workflow/Network sub-entities
DELETE FROM workflow_version;
DELETE FROM workflow_metric_daily;
DELETE FROM network_primitive;
DELETE FROM network_version;
DELETE FROM network_metric_daily;
DELETE FROM deployment;
DELETE FROM bim_takeoff;
DELETE FROM bim_clash;
DELETE FROM bim_diff_summary;
DELETE FROM bim_model_version;

-- Level 4: Core entities
DELETE FROM agent;
DELETE FROM workflow;
DELETE FROM network;
DELETE FROM bim_model;

-- Level 5: Integration and misc
DELETE FROM chat_message;
DELETE FROM meeting_transcript;
DELETE FROM action_item;
DELETE FROM approval_request;
DELETE FROM identity_mapping;
DELETE FROM crm_audit_log;
DELETE FROM integration_connection;
DELETE FROM tool_credential;
DELETE FROM organization_invite;
DELETE FROM organization_domain;

-- Level 5b: Providers (after connections)
DELETE FROM integration_provider;

-- Level 6: Other
DELETE FROM channel_session;
DELETE FROM channel_credentials;
DELETE FROM voice_call_log;
DELETE FROM voice_agent_trace;
DELETE FROM audit_log;
DELETE FROM stored_agent;

-- Mastra-managed tables (may not exist)
DO $$ BEGIN DELETE FROM mastra_message; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM mastra_thread; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM mastra_resource; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- RAG vector data
DROP TABLE IF EXISTS rag_documents;

COMMIT;

-- Verification
SELECT 'Agents' as entity, count(*) as remaining FROM agent
UNION ALL SELECT 'Providers', count(*) FROM integration_provider
UNION ALL SELECT 'Connections', count(*) FROM integration_connection
UNION ALL SELECT 'Agent Runs', count(*) FROM agent_run
UNION ALL SELECT 'Workflows', count(*) FROM workflow
UNION ALL SELECT 'Networks', count(*) FROM network
UNION ALL SELECT 'Audit Logs', count(*) FROM audit_log
UNION ALL SELECT 'Organizations (kept)', count(*) FROM organization
UNION ALL SELECT 'Workspaces (kept)', count(*) FROM workspace
UNION ALL SELECT 'Users (kept)', count(*) FROM "user"
UNION ALL SELECT 'Memberships (kept)', count(*) FROM membership;
