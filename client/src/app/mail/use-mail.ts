import { atom, useAtom } from "jotai"
import { Mail } from "@/lib/data/mail"

// Global mail state management via jotai

type Config = {
    selected: Mail["id"] | null
}

const configAtom = atom<Config>({
    selected: null,
})

export function useMail() {
    return useAtom(configAtom)
}
