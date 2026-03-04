import { ReactNode } from "react"
import { useUIStore } from "@/lib/store"
import { cn } from "@/lib/utils"

interface WorkspaceShellProps {
    /** The top horizontal header area */
    header: ReactNode;
    /** The optional extreme left rail (e.g. for app switching) */
    leftRail?: ReactNode;
    /** The optional sidebar navigation area */
    sidebar?: ReactNode;
    /** The main content area */
    children: ReactNode;
    /** The optional extreme right rail (e.g. for addons) */
    rightRail?: ReactNode;
    /** Additional classes for the root container (e.g. for backgrounds or fonts) */
    className?: string;
}

export function WorkspaceShell({ 
    header, 
    leftRail, 
    sidebar, 
    children, 
    rightRail, 
    className 
}: WorkspaceShellProps) {
    const { sidebarCollapsed, rightSidebarOpen } = useUIStore()

    return (
        <div className={cn(
            "h-screen w-screen flex flex-col overflow-hidden transition-all duration-300",
            sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-60',
            rightSidebarOpen ? 'pr-[24rem]' : 'pr-16',
            className
        )}>
            {/* Global Workspace Header Area */}
            {header}

            {/* Workspace Body Area */}
            <div className="flex flex-1 overflow-hidden">
                {leftRail}
                {sidebar}
                
                {/* Scalable Main Content Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    {children}
                </div>

                {rightRail}
            </div>
        </div>
    )
}
