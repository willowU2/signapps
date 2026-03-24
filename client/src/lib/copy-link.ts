export async function copyLink(url?: string): Promise<boolean> {
  const link = url || window.location.href;
  try {
    await navigator.clipboard.writeText(link);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = link;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
