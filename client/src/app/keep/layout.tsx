// Keep page uses WorkspaceShell which already includes the global Sidebar.
// Wrapping with AppLayout would create a duplicate sidebar.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
