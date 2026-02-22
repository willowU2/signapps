import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AiRole = 'chat' | 'docs' | 'mail' | 'slides' | 'default';

export interface AiTaskRoutingConfig {
    providerId: string | null;
    modelId: string | null;
}

interface AiRoutingState {
    // Configuration mapping role to its designated AI provider & model
    routes: Record<AiRole, AiTaskRoutingConfig>;

    // Actions
    setRouteTarget: (role: AiRole, providerId: string, modelId: string) => void;
    clearRouteTarget: (role: AiRole) => void;

    // Utility getter that falls back to default if role is not strictly defined
    getRouteConfig: (role: AiRole) => AiTaskRoutingConfig;
}

export const useAiRouting = create<AiRoutingState>()(
    persist(
        (set, get) => ({
            routes: {
                chat: { providerId: null, modelId: null },
                docs: { providerId: null, modelId: null },
                mail: { providerId: null, modelId: null },
                slides: { providerId: null, modelId: null },
                default: { providerId: null, modelId: null },
            },

            setRouteTarget: (role: AiRole, providerId: string, modelId: string) =>
                set((state) => ({
                    routes: {
                        ...state.routes,
                        [role]: { providerId, modelId }
                    }
                })),

            clearRouteTarget: (role: AiRole) =>
                set((state) => ({
                    routes: {
                        ...state.routes,
                        [role]: { providerId: null, modelId: null }
                    }
                })),

            getRouteConfig: (role: AiRole) => {
                const config = get().routes[role];
                // If the targeted role has precise configuration, return it
                if (config && config.providerId && config.modelId) {
                    return config;
                }
                // Fallback to the 'default' role
                const defaultConfig = get().routes['default'];
                if (defaultConfig && defaultConfig.providerId && defaultConfig.modelId) {
                    return defaultConfig;
                }

                // Absolute fallback (Ollama is expected to be present natively)
                return { providerId: 'ollama', modelId: 'llama3.2:3b' };
            }
        }),
        {
            name: 'signapps-ai-routing-storage',
        }
    )
);
