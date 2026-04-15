import { AppLayout } from "@/components/layout/app-layout";

// The page below uses WorkspaceShell with `hideGlobalSidebar={true}` to render
// its own custom left sidebar (accounts + labels). Without an AppLayout
// wrapper here, the top header, the global left sidebar, and the right
// sidebar were all missing entirely — the mail page looked like it dropped
// out of the app shell. AppLayout brings the shell back; WorkspaceShell's
// `hideGlobalSidebar` prevents double-rendering the left sidebar.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
