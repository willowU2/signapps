export const IT_ASSETS_API = "http://localhost:3014/api/v1"

export interface Hardware {
    id: string
    name: string
    hardware_type: string
    status: string
    mac_address?: string
    ip_address?: string
    purchase_date?: string
    warranty_expiry?: string
    notes?: string
}

export async function getHardware(): Promise<Hardware[]> {
    try {
        const res = await fetch(`${IT_ASSETS_API}/hardware`)
        if (!res.ok) throw new Error("Failed to fetch hardware")
        return res.json()
    } catch (e) {
        console.warn("Using mock hardware data due to API error:", e)
        return [
            { id: "1", name: "LAPTOP-JD", hardware_type: "laptop", status: "active", mac_address: "aa:bb:cc:dd:ee:01" },
            { id: "2", name: "SRV-WEB-01", hardware_type: "server", status: "active", mac_address: "00:11:22:33:44:55", ip_address: "10.0.0.10" },
            { id: "3", name: "SW-CORE-01", hardware_type: "switch", status: "maintenance", mac_address: "ff:ee:dd:cc:bb:aa", ip_address: "10.0.0.1" },
        ]
    }
}

export async function createHardware(hardware: Omit<Hardware, "id">): Promise<Hardware> {
    const res = await fetch(`${IT_ASSETS_API}/hardware`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hardware),
    })
    if (!res.ok) throw new Error("Failed to create hardware")
    return res.json()
}
