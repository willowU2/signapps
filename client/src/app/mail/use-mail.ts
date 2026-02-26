import { atom, useAtom } from "jotai"
import { Mail } from "@/lib/data/mail"

// We can use jotai for simple global state if needed, or unnecessary for this simple mock
// Leaving this file here as a placeholder for cleaner state management later
// For now, the page.tsx handles state.
// Actually let's just make a hook-like config if needed.

type Config = {
    selected: Mail["id"] | null
}

const configAtom = atom<Config>({
    selected: null,
})

export function useMail() {
    return useAtom(configAtom)
}
