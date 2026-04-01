import { toast } from "sonner";

export function useToast() {
  return {
    toast: (message: string, options?: Record<string, unknown>) => {
      toast.message(message, options as Parameters<typeof toast.message>[1]);
    },
    error: (message: string, options?: Record<string, unknown>) => {
      toast.error(message, options as Parameters<typeof toast.error>[1]);
    },
    success: (message: string, options?: Record<string, unknown>) => {
      toast.success(message, options as Parameters<typeof toast.success>[1]);
    },
    loading: (message: string, options?: Record<string, unknown>) => {
      toast.loading(message, options as Parameters<typeof toast.loading>[1]);
    },
  };
}
