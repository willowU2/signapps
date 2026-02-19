import { toast } from "sonner";

export function useToast() {
  return {
    toast: (message: string, options?: any) => {
      toast.message(message, options);
    },
    error: (message: string, options?: any) => {
      toast.error(message, options);
    },
    success: (message: string, options?: any) => {
      toast.success(message, options);
    },
    loading: (message: string, options?: any) => {
      toast.loading(message, options);
    },
  };
}
