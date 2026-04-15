"use client";

import { useUIStore } from "@/lib/store";
import { CreateWorkspaceModal } from "./modals/create-workspace-modal";
import { CreateProjectModal } from "./modals/create-project-modal";
import { CreateTaskModal } from "./modals/create-task-modal";

export function GlobalModals() {
  const {
    createWorkspaceModalOpen,
    createProjectModalOpen,
    createTaskModalOpen,
    setCreateWorkspaceModalOpen,
    setCreateProjectModalOpen,
    setCreateTaskModalOpen,
  } = useUIStore();

  return (
    <>
      <CreateWorkspaceModal
        open={createWorkspaceModalOpen}
        onOpenChange={setCreateWorkspaceModalOpen}
      />
      <CreateProjectModal
        open={createProjectModalOpen}
        onOpenChange={setCreateProjectModalOpen}
      />
      <CreateTaskModal
        open={createTaskModalOpen}
        onOpenChange={setCreateTaskModalOpen}
      />
    </>
  );
}
