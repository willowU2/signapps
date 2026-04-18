# Migration idempotence audit

| File | Offending pattern | Count |
|---|---|---|
| `migrations/001_initial_schema.sql` | CREATE TABLE without IF NOT EXISTS | 20 |
| `migrations/001_initial_schema.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 19 |
| `migrations/008_collections.sql` | ADD CONSTRAINT without IF NOT EXISTS | 1 |
| `migrations/009_collab_documents.sql` | CREATE TABLE without IF NOT EXISTS | 5 |
| `migrations/009_collab_documents.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 11 |
| `migrations/011_calendar_schema.sql` | CREATE TABLE without IF NOT EXISTS | 11 |
| `migrations/011_calendar_schema.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 28 |
| `migrations/016_chat_support.sql` | ADD CONSTRAINT without IF NOT EXISTS | 1 |
| `migrations/022_admin_storage_settings.sql` | CREATE TABLE without IF NOT EXISTS | 2 |
| `migrations/022_admin_storage_settings.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 2 |
| `migrations/024_ai_collections_defaults.sql` | ADD CONSTRAINT without IF NOT EXISTS | 1 |
| `migrations/026_mail_schema.sql` | CREATE TABLE without IF NOT EXISTS | 6 |
| `migrations/026_mail_schema.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 16 |
| `migrations/027_meet_schema.sql` | CREATE TABLE without IF NOT EXISTS | 4 |
| `migrations/027_meet_schema.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 12 |
| `migrations/029_drive_vfs.sql` | CREATE TYPE without DO-block guard | 2 |
| `migrations/031_multi_tenant_calendar.sql` | ADD CONSTRAINT without IF NOT EXISTS | 3 |
| `migrations/031_multi_tenant_calendar.sql` | CREATE TYPE without DO-block guard | 5 |
| `migrations/034_scheduling_time_items.sql` | CREATE TABLE without IF NOT EXISTS | 9 |
| `migrations/034_scheduling_time_items.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 32 |
| `migrations/035_workforce_schema.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 24 |
| `migrations/038_ai_ingestion_triggers.sql` | ADD CONSTRAINT without IF NOT EXISTS | 1 |
| `migrations/048_update_drive_nodes_check_constraint.sql` | ADD CONSTRAINT without IF NOT EXISTS | 1 |
| `migrations/049_calendar_attendees_external.sql` | ADD CONSTRAINT without IF NOT EXISTS | 2 |
| `migrations/052_user_signatures.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 1 |
| `migrations/054_email_templates.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 1 |
| `migrations/055_billing_line_items_payments.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 2 |
| `migrations/060_combined.sql` | ADD CONSTRAINT without IF NOT EXISTS | 2 |
| `migrations/062_social_media.sql` | CREATE TABLE without IF NOT EXISTS | 8 |
| `migrations/062_social_media.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 6 |
| `migrations/063_social_enhancements.sql` | CREATE TABLE without IF NOT EXISTS | 10 |
| `migrations/063_social_enhancements.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 13 |
| `migrations/084_missing_schemas_billing_tables.sql` | CREATE TABLE without IF NOT EXISTS | 2 |
| `migrations/088_social_fk_constraints.sql` | ADD CONSTRAINT without IF NOT EXISTS | 13 |
| `migrations/089_cycle_guards_indexes_rls.sql` | ADD CONSTRAINT without IF NOT EXISTS | 2 |
| `migrations/091_notifications_schema_reconcile.sql` | ADD CONSTRAINT without IF NOT EXISTS | 1 |
| `migrations/093_calendar_unified_event_types.sql` | CREATE TYPE without DO-block guard | 7 |
| `migrations/095_calendar_hr_tables.sql` | ADD CONSTRAINT without IF NOT EXISTS | 1 |
| `migrations/095_calendar_hr_tables.sql` | CREATE TYPE without DO-block guard | 2 |
| `migrations/116_it_tables_extend.sql` | ADD CONSTRAINT without IF NOT EXISTS | 1 |
| `migrations/118_drive_acl.sql` | CREATE TYPE without DO-block guard | 3 |
| `migrations/137_vault_schema.sql` | CREATE TYPE without DO-block guard | 4 |
| `migrations/143_social_oauth_states.sql` | ADD CONSTRAINT without IF NOT EXISTS | 1 |
| `migrations/148_fix_drive_nodes_unique_constraint.sql` | ADD CONSTRAINT without IF NOT EXISTS | 1 |
| `migrations/20260411085535_drive_nodes_unique_node_type.sql` | ADD CONSTRAINT without IF NOT EXISTS | 1 |
| `migrations/211_org_boards.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 2 |
| `migrations/212_governance_policy_domain.sql` | ADD CONSTRAINT without IF NOT EXISTS | 1 |
| `migrations/213_ad_domains.sql` | CREATE TABLE without IF NOT EXISTS | 1 |
| `migrations/213_ad_domains.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 2 |
| `migrations/214_ad_principal_keys.sql` | CREATE TABLE without IF NOT EXISTS | 1 |
| `migrations/214_ad_principal_keys.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 2 |
| `migrations/215_ad_dns.sql` | CREATE TABLE without IF NOT EXISTS | 2 |
| `migrations/215_ad_dns.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 3 |
| `migrations/216_lightrag_knowledge_graph.sql` | CREATE TABLE without IF NOT EXISTS | 3 |
| `migrations/216_lightrag_knowledge_graph.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 9 |
| `migrations/218_infrastructure_domains.sql` | CREATE TABLE without IF NOT EXISTS | 1 |
| `migrations/218_infrastructure_domains.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 2 |
| `migrations/219_infrastructure_certificates.sql` | CREATE TABLE without IF NOT EXISTS | 1 |
| `migrations/219_infrastructure_certificates.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 2 |
| `migrations/220_infrastructure_dhcp.sql` | CREATE TABLE without IF NOT EXISTS | 3 |
| `migrations/220_infrastructure_dhcp.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 4 |
| `migrations/221_infrastructure_deploy.sql` | CREATE TABLE without IF NOT EXISTS | 3 |
| `migrations/221_infrastructure_deploy.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 3 |
| `migrations/224_ad_objects.sql` | CREATE TABLE without IF NOT EXISTS | 3 |
| `migrations/224_ad_objects.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 6 |
| `migrations/225_ad_groups.sql` | CREATE TABLE without IF NOT EXISTS | 2 |
| `migrations/225_ad_groups.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 3 |
| `migrations/226_ad_sync_queue.sql` | CREATE TABLE without IF NOT EXISTS | 1 |
| `migrations/226_ad_sync_queue.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 3 |
| `migrations/227_ad_node_mail_domains.sql` | CREATE TABLE without IF NOT EXISTS | 1 |
| `migrations/227_ad_node_mail_domains.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 1 |
| `migrations/228_ad_dc_management.sql` | CREATE TABLE without IF NOT EXISTS | 2 |
| `migrations/228_ad_dc_management.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 3 |
| `migrations/229_ad_snapshots.sql` | CREATE TABLE without IF NOT EXISTS | 1 |
| `migrations/229_ad_snapshots.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 3 |
| `migrations/230_ad_mail.sql` | CREATE TABLE without IF NOT EXISTS | 3 |
| `migrations/230_ad_mail.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 5 |
| `migrations/232_sharing_schema.sql` | CREATE TABLE without IF NOT EXISTS | 6 |
| `migrations/232_sharing_schema.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 9 |
| `migrations/234_add_presentation_to_drive_constraint.sql` | ADD CONSTRAINT without IF NOT EXISTS | 1 |
| `migrations/250_accounting_schema.sql` | CREATE TABLE without IF NOT EXISTS | 3 |
| `migrations/250_accounting_schema.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 4 |
| `migrations/251_expenses_schema.sql` | CREATE TABLE without IF NOT EXISTS | 1 |
| `migrations/251_expenses_schema.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 2 |
| `migrations/252_timesheet_schema.sql` | CREATE TABLE without IF NOT EXISTS | 1 |
| `migrations/252_timesheet_schema.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 2 |
| `migrations/253_gamification_schema.sql` | CREATE TABLE without IF NOT EXISTS | 3 |
| `migrations/253_gamification_schema.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 2 |
| `migrations/254_collaboration_schema.sql` | CREATE TABLE without IF NOT EXISTS | 1 |
| `migrations/254_collaboration_schema.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 1 |
| `migrations/261_help_status_schema.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 1 |
| `migrations/267_dashboard_keep_schema.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 1 |
| `migrations/270_unified_person_model.sql` | ADD CONSTRAINT without IF NOT EXISTS | 1 |
| `migrations/276_performance_indexes.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 2 |
| `migrations/280_projects_org_aware.sql` | ADD CONSTRAINT without IF NOT EXISTS | 1 |
| `migrations/302_oauth_unified.sql` | CREATE TABLE without IF NOT EXISTS | 4 |
| `migrations/302_oauth_unified.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 4 |
| `migrations/305_deployments.sql` | CREATE TABLE without IF NOT EXISTS | 2 |
| `migrations/305_deployments.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 4 |
| `migrations/306_scheduled_maintenance.sql` | CREATE TABLE without IF NOT EXISTS | 1 |
| `migrations/306_scheduled_maintenance.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 2 |
| `migrations/307_feature_flags_runtime_config.sql` | CREATE TABLE without IF NOT EXISTS | 2 |
| `migrations/307_feature_flags_runtime_config.sql` | CREATE [UNIQUE] INDEX without IF NOT EXISTS | 2 |
| `migrations/309_maintenance_flags.sql` | CREATE TABLE without IF NOT EXISTS | 1 |
| `migrations/310_active_stack.sql` | CREATE TABLE without IF NOT EXISTS | 1 |

**Files with issues:** 69
**Total offending statements:** 447
