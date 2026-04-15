// Interoperability components — 50 cross-module connections
// Grouped by feature area
//
// Ideas 21 (Global favorites / bookmark any entity) and 22 (Global tags) are
// already implemented in:
//   src/components/crosslinks/CrossModuleFavorites.tsx  (StarButton, BookmarksPage)
//   src/components/crosslinks/GlobalTags.tsx            (GlobalTags, TagFilterPanel)

// Ideas 1-2: Forms bridges
export {
  FormResponseToContact,
  FormResponseToSheet,
} from "./forms-contacts-bridge";

// Ideas 3, 18: LMS / HR bridges
export {
  LmsCourseToHrSkill,
  HrOnboardingTrigger,
  triggerHrOnboarding,
} from "./lms-hr-bridge";

// Ideas 4, 19, 20: Supply chain / billing / accounting bridges
export {
  PoToInvoice,
  PaymentAccountingSync,
  AccountingToInvoice,
} from "./supply-billing-bridge";

// Ideas 5, 6, 17: IT / HR / compliance / monitoring bridges
export {
  EmployeeAssetsPanel,
  ComplianceToLegalForm,
  MonitoringAlertToTicket,
} from "./it-hr-compliance-bridge";

// Ideas 7, 13, 16: Meet / doc / slides bridges
export {
  MeetRecordingToDoc,
  SlidesToMeet,
  MeetAttendeeContacts,
} from "./meet-doc-bridge";

// Ideas 8-9: Keep note conversions
export { NoteToDoc, NoteToTask } from "./keep-convert";

// Ideas 10-12: Design exports + Sheets → CRM
export {
  DesignToSocialPost,
  DesignToEmailTemplate,
  SheetsToCrmReport,
} from "./design-export-bridge";

// Ideas 14-15, 24: Chat share + task creation
export {
  ShareEntityToChat,
  ChatMessageToTask,
  FileShareToChat,
} from "./chat-share-bridge";

// Ideas 25, 30: Unified timeline / activity log
export { UnifiedTimeline } from "./unified-timeline";

// Ideas 23, 26, 27: Context menu + drag-drop
export {
  CrossModuleContextMenu,
  useEmailToTaskDrop,
} from "./context-menu-cross";

// Ideas 28, 33, 39: Linked entities + duplicate detection + smart links
export {
  LinkedEntitiesPanel,
  DuplicateDetector,
} from "./linked-entities-panel";

// Ideas 29, 45: Smart suggestions + smart routing
export { SmartSuggestions, smartRoute } from "./smart-suggestions";

// Ideas 31-32: Export + import
export { UnifiedExportDialog, SmartImport } from "./cross-module-export-import";

// Ideas 34-36: Data sync + permissions + templates
export {
  DataSyncRules,
  PermissionInheritance,
  CrossModuleTemplates,
} from "./data-sync-permissions";

// Ideas 37-38: Unified settings + analytics
export {
  UnifiedInteropSettings,
  CrossModuleAnalytics,
} from "./unified-settings";

// Ideas 40-42: Global undo + clipboard + batch ops
export {
  GlobalUndoButton,
  pushUndo,
  useEntityClipboard,
  EntityCopyButton,
  EntityPasteAsLink,
  CrossModuleBatchOps,
} from "./global-undo-clipboard";

// Ideas 43-44: Cross-module comments + activity digests
export {
  CrossModuleComments,
  ActivityDigestSettings,
} from "./cross-module-comments";

// Ideas 46-47: Cross-module search + unified contacts
export {
  CrossModuleSearchBar,
  UnifiedContactCard,
} from "./cross-module-search-filters";

// Ideas 48-49: Unified notifications + module health
export {
  CrossModuleNotificationCenter,
  ModuleHealthDashboard,
} from "./unified-notifications";

// Idea 50: Cross-module API keys
export { CrossModuleApiKeys } from "./cross-module-api";
