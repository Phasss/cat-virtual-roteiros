function baixarRoteiroPDF() {
  var statusEl = document.getElementById("pdf-status");
  try {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: "pt", format: "a4" });
    var data = window.ROTEIRO_DATA;
    var margin = 48;
    var pageWidth = doc.internal.pageSize.getWidth();
    var pageHeight = doc.internal.pageSize.getHeight();
    var contentWidth = pageWidth - margin * 2;
    var y;

    doc.setFillColor(14, 110, 108);
    doc.rect(0, 0, pageWidth, 112, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("CAT VIRTUAL · RECIFE ANTIGO", margin, 34);
    doc.setFontSize(22);
    doc.text(data.name, margin, 66);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(data.tagline, margin, 88, { maxWidth: contentWidth });

    y = 142;
    doc.setTextColor(30, 40, 35);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    var totalMin = data.route.walkMinutes + data.route.visitMinutes;
    doc.text(
      data.route.stops.length + " paradas   ·   ~" + totalMin + " min no total   ·   " + data.route.totalMeters + " m a pé",
      margin,
      y
    );
    y += 22;
    doc.setDrawColor(214, 222, 218);
    doc.line(margin, y, pageWidth - margin, y);
    y += 26;

    data.route.stops.forEach(function (stop, i) {
      if (y > pageHeight - 110) {
        doc.addPage();
        y = margin;
      }

      doc.setFillColor(14, 110, 108);
      doc.circle(margin + 8, y - 4, 9, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(String(i + 1), margin + 8, y - 1, { align: "center" });

      doc.setTextColor(22, 33, 29);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(stop.name, margin + 26, y, { maxWidth: contentWidth - 26 });
      y += 16;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(82, 96, 88);
      var descLines = doc.splitTextToSize(stop.description || "", contentWidth - 26);
      doc.text(descLines, margin + 26, y);
      y += descLines.length * 13 + 6;

      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      var legText = i === 0 ? "a partir do Marco Zero" : "da parada anterior";
      doc.text(legText + " · " + stop.legMeters + " m", margin + 26, y);
      y += 24;
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(150, 150, 150);
    doc.text(
      "Gerado por CAT Virtual — totem de atendimento ao turista do Rec'n'Play. Distâncias estimadas.",
      margin,
      pageHeight - 26
    );

    doc.save(data.id + "-recife-antigo.pdf");
    if (statusEl) statusEl.textContent = "PDF baixado!";
  } catch (err) {
    if (statusEl) statusEl.textContent = "Não foi possível gerar o PDF agora. Tente de novo.";
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  var btn = document.getElementById("pdf-btn");
  if (btn) btn.addEventListener("click", baixarRoteiroPDF);
});
