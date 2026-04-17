import { ReactNode } from "react";
import { useUIStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { AiChatBar } from "./ai-chat-bar";

interface WorkspaceShellProps {
  /** The top horizontal header area */
  header: ReactNode;
  /** The optional sidebar navigation area */
  sidebar?: ReactNode;
  /** The main content area */
  children: ReactNode;
  /** The optional extreme right rail (e.g. for addons) */
  rightRail?: ReactNode;
  /** Additional classes for the root container (e.g. for backgrounds or fonts) */
  className?: string;
  /** Hide the global sidebar entirely (e.g. for Mail which has its own sidebar) */
  hideGlobalSidebar?: boolean;
  /** Hide the right sidebar rail (e.g. for full-width modules) */
  hideRightSidebar?: boolean;
  /**
   * Render the content area as a plain `<div>` instead of `<main
   * id="main-content">`. Set this when a parent layout (e.g. `AppLayout`)
   * already provides the main landmark — otherwise axe reports
   * `landmark-no-duplicate-main`. Defaults to `false`.
   */
  hideMainLandmark?: boolean;
}

export function WorkspaceShell({
  header,
  sidebar,
  children,
  rightRail,
  className,
  hideGlobalSidebar = false,
  hideRightSidebar = false,
  hideMainLandmark = false,
}: WorkspaceShellProps) {
  const { sidebarCollapsed, rightSidebarOpen } = useUIStore();

  const ContentWrapper = hideMainLandmark ? "div" : "main";
  const contentProps = hideMainLandmark ? {} : { id: "main-content" as const };

  return (
    // AQ-MOBI: no left padding on mobile (sidebar hidden as drawer), md+ uses sidebar width
    <div
      className={cn(
        "h-screen w-full flex flex-col overflow-hidden transition-all duration-300",
        hideGlobalSidebar ? "" : sidebarCollapsed ? "md:pl-16" : "md:pl-64",
        hideRightSidebar ? "" : rightSidebarOpen ? "md:pr-[24rem]" : "md:pr-16",
        className,
      )}
    >
      {!hideGlobalSidebar && <Sidebar />}

      {/* Global Workspace Header Area */}
      {header}

      {/* Workspace Body Area */}
      <div className="flex flex-1 overflow-hidden">
        {sidebar}

        {/* Scalable Main Content Area */}
        <ContentWrapper
          {...contentProps}
          className="flex-1 flex flex-col min-w-0"
        >
          {children}
        </ContentWrapper>

        {rightRail}
      </div>

      <AiChatBar />
    </div>
  );
}
