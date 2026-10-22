function hexToRgb(hex) {
  var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "#1B0CAD");
  if (!m) return [27, 12, 173];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

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

    function drawFooter() {
      var page = doc.internal.getCurrentPageInfo().pageNumber;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(150, 150, 150);
      doc.text("CAT Virtual — totem de atendimento ao turista do Rec'n'Play. Distâncias estimadas.", margin, pageHeight - 26);
      doc.text("pág. " + page, pageWidth - margin, pageHeight - 26, { align: "right" });
    }

    function drawRouteMap(startY, stops) {
      var mapHeight = 190;
      if (startY + mapHeight > pageHeight - 70) {
        drawFooter();
        doc.addPage();
        startY = margin + 10;
      }

      doc.setTextColor(22, 33, 46);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("No mapa", margin, startY);
      startY += 12;

      var boxY = startY;
      var boxH = mapHeight - 12;
      doc.setFillColor(241, 241, 241);
      doc.roundedRect(margin, boxY, contentWidth, boxH, 8, 8, "F");
      doc.setDrawColor(216, 226, 234);
      doc.roundedRect(margin, boxY, contentWidth, boxH, 8, 8, "S");

      var pad = 26;
      var innerW = contentWidth - pad * 2;
      var innerH = boxH - pad * 2;

      var lats = stops.map(function (s) { return s.lat; });
      var lngs = stops.map(function (s) { return s.lng; });
      var minLat = Math.min.apply(null, lats);
      var maxLat = Math.max.apply(null, lats);
      var minLng = Math.min.apply(null, lngs);
      var maxLng = Math.max.apply(null, lngs);
      var latRange = Math.max(maxLat - minLat, 0.0006);
      var lngRange = Math.max(maxLng - minLng, 0.0006);

      function project(lat, lng) {
        var x = margin + pad + ((lng - minLng) / lngRange) * innerW;
        var y2 = boxY + pad + (1 - (lat - minLat) / latRange) * innerH;
        return [x, y2];
      }

      doc.setDrawColor(27, 12, 173);
      doc.setLineWidth(1.3);
      doc.setLineDashPattern([3, 2], 0);
      for (var i = 0; i < stops.length - 1; i++) {
        var p1 = project(stops[i].lat, stops[i].lng);
        var p2 = project(stops[i + 1].lat, stops[i + 1].lng);
        doc.line(p1[0], p1[1], p2[0], p2[1]);
      }
      doc.setLineDashPattern([], 0);

      stops.forEach(function (stop, i) {
        var p = project(stop.lat, stop.lng);
        var rgb = hexToRgb(stop.accent);
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(1.6);
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
        doc.circle(p[0], p[1], 8, "FD");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(String(i + 1), p[0], p[1] + 2.8, { align: "center" });
      });

      doc.setTextColor(150, 150, 150);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.text("Mapa esquemático, fora de escala — siga a ordem numerada das paradas.", margin, boxY + boxH + 14);

      return boxY + boxH + 28;
    }

    // Cabeçalho
    doc.setFillColor(27, 12, 173);
    doc.rect(0, 0, pageWidth, 112, "F");
    doc.setFillColor(255, 0, 165);
    doc.rect(0, 112, pageWidth, 4, "F");
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
    doc.setTextColor(22, 33, 46);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    var totalMin = data.route.walkMinutes + data.route.visitMinutes;
    doc.text(
      data.route.stops.length + " paradas   ·   ~" + totalMin + " min no total   ·   " + data.route.totalMeters + " m a pé",
      margin,
      y
    );
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(82, 96, 109);
    doc.text("Como chegar de ônibus: linhas 032 · 041 · 064 · 117 · 516 · 521 (parada Marco Zero / Av. Alfredo Lisboa)", margin, y);
    y += 20;
    doc.setDrawColor(213, 222, 230);
    doc.line(margin, y, pageWidth - margin, y);
    y += 26;

    data.route.stops.forEach(function (stop, i) {
      if (y > pageHeight - 130) {
        drawFooter();
        doc.addPage();
        y = margin + 10;
      }

      var rgb = hexToRgb(stop.accent);
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.circle(margin + 9, y - 4, 10, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(String(i + 1), margin + 9, y - 1, { align: "center" });

      doc.setTextColor(22, 33, 46);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(stop.name, margin + 28, y, { maxWidth: contentWidth - 28 });
      y += 16;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(82, 96, 109);
      var descLines = doc.splitTextToSize(stop.description || "", contentWidth - 28);
      doc.text(descLines, margin + 28, y);
      y += descLines.length * 13 + 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(82, 96, 109);
      doc.text(stop.address || "", margin + 28, y, { maxWidth: contentWidth - 28 });
      y += 14;

      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      var legText = i === 0 ? "a partir do Marco Zero" : "da parada anterior";
      doc.text(legText + " · " + stop.legMeters + " m", margin + 28, y);
      y += 14;

      doc.setDrawColor(233, 237, 241);
      doc.line(margin + 28, y, pageWidth - margin, y);
      y += 18;
    });

    y = drawRouteMap(y + 6, data.route.stops);

    y += 6;
    if (y > pageHeight - 120) {
      drawFooter();
      doc.addPage();
      y = margin;
    }
    doc.setFillColor(220, 230, 240);
    doc.roundedRect(margin, y, contentWidth, 54, 6, 6, "F");
    doc.setTextColor(22, 33, 46);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Antes de sair", margin + 14, y + 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(82, 96, 109);
    var tipLines = doc.splitTextToSize(
      "Leve água e protetor solar, use calçado confortável para pedras portuguesas, e confira o horário de cada museu antes de ir — alguns fecham às segundas-feiras.",
      contentWidth - 28
    );
    doc.text(tipLines, margin + 14, y + 34);

    drawFooter();

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
