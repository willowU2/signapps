/**
 * Trigger print dialog for PDF export using print CSS
 */
export function exportPdf(title?: string) {
  const original = document.title;
  if (title) document.title = title;
  window.print();
  if (title) document.title = original;
}
