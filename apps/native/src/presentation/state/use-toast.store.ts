import { create } from "zustand";

export type ToastTone = "info" | "success" | "error";

export type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
};

type ToastStore = {
  current: Toast | null;
  show(input: Omit<Toast, "id">): void;
  dismiss(): void;
};

let nextId = 1;

export const useToastStore = create<ToastStore>((set) => ({
  current: null,
  show: (input) => {
    const id = `toast-${nextId++}`;
    set({ current: { id, ...input } });
  },
  dismiss: () => set({ current: null }),
}));

export const toast = (message: string, tone: ToastTone = "info", action?: { label: string; onPress: () => void }) => {
  useToastStore.getState().show({
    message,
    tone,
    actionLabel: action?.label,
    onAction: action?.onPress,
  });
};
