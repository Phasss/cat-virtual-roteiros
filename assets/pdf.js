function hexToRgb(hex) {
  var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "#1B0CAD");
  if (!m) return [27, 12, 173];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

// Web Mercator helpers (slippy-map tile math) — global pixel coords at a given zoom.
function lon2px(lon, zoom) {
  return ((lon + 180) / 360) * Math.pow(2, zoom) * 256;
}

function lat2px(lat, zoom) {
  var rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom) * 256;
}

async function buildStaticMapImage(stops, pxW, pxH) {
  try {
    if (!stops.length || typeof createImageBitmap === "undefined") return null;

    var innerPad = 56;
    var fitW = pxW - innerPad * 2;
    var fitH = pxH - innerPad * 2;
    var lats = stops.map(function (s) { return s.lat; });
    var lngs = stops.map(function (s) { return s.lng; });
    var minLat = Math.min.apply(null, lats);
    var maxLat = Math.max.apply(null, lats);
    var minLng = Math.min.apply(null, lngs);
    var maxLng = Math.max.apply(null, lngs);

    var zoom = 18;
    while (zoom > 12) {
      var w = lon2px(maxLng, zoom) - lon2px(minLng, zoom);
      var h = lat2px(minLat, zoom) - lat2px(maxLat, zoom);
      if (w <= fitW && h <= fitH) break;
      zoom--;
    }

    var centerPxX = (lon2px(minLng, zoom) + lon2px(maxLng, zoom)) / 2;
    var centerPxY = (lat2px(minLat, zoom) + lat2px(maxLat, zoom)) / 2;
    var originPxX = centerPxX - pxW / 2;
    var originPxY = centerPxY - pxH / 2;

    var maxTileIndex = Math.pow(2, zoom) - 1;
    var tileMinX = Math.max(0, Math.floor(originPxX / 256));
    var tileMaxX = Math.min(maxTileIndex, Math.floor((originPxX + pxW - 1) / 256));
    var tileMinY = Math.max(0, Math.floor(originPxY / 256));
    var tileMaxY = Math.min(maxTileIndex, Math.floor((originPxY + pxH - 1) / 256));

    var canvas = document.createElement("canvas");
    canvas.width = pxW;
    canvas.height = pxH;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#eef3f8";
    ctx.fillRect(0, 0, pxW, pxH);

    var fetches = [];
    var successCount = 0;
    for (var tx = tileMinX; tx <= tileMaxX; tx++) {
      for (var ty = tileMinY; ty <= tileMaxY; ty++) {
        (function (tx, ty) {
          var url = "https://tile.openstreetmap.org/" + zoom + "/" + tx + "/" + ty + ".png";
          fetches.push(
            fetch(url)
              .then(function (r) {
                if (!r.ok) throw new Error("tile " + r.status);
                return r.blob();
              })
              .then(createImageBitmap)
              .then(function (bmp) {
                ctx.drawImage(bmp, tx * 256 - originPxX, ty * 256 - originPxY, 256, 256);
                successCount++;
              })
              .catch(function () {})
          );
        })(tx, ty);
      }
    }

    if (!fetches.length) return null;
    await Promise.all(fetches);
    if (successCount === 0) return null;

    function projectStop(s) {
      return [lon2px(s.lng, zoom) - originPxX, lat2px(s.lat, zoom) - originPxY];
    }

    ctx.setLineDash([7, 6]);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = "#1B0CAD";
    ctx.beginPath();
    stops.forEach(function (s, i) {
      var p = projectStop(s);
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    stops.forEach(function (s, i) {
      var p = projectStop(s);
      var rgb = hexToRgb(s.accent);
      ctx.beginPath();
      ctx.arc(p[0], p[1], 12, 0, Math.PI * 2);
      ctx.fillStyle = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), p[0], p[1] + 1);
    });

    return canvas.toDataURL("image/png");
  } catch (err) {
    console.error("Falha ao montar mapa estático do PDF", err);
    return null;
  }
}

async function baixarRoteiroPDF() {
  var statusEl = document.getElementById("pdf-status");
  if (statusEl) statusEl.textContent = "Gerando PDF…";
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

    function drawSchematicRoute(boxY, boxH, stops) {
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
        var yy = boxY + pad + (1 - (lat - minLat) / latRange) * innerH;
        return [x, yy];
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
    }

    async function drawRouteMap(startY, stops) {
      var mapDisplayHeight = 260;
      var blockHeight = 20 + mapDisplayHeight + 26;
      if (startY + blockHeight > pageHeight - 70) {
        drawFooter();
        doc.addPage();
        startY = margin + 10;
      }

      doc.setTextColor(22, 33, 46);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("No mapa", margin, startY);
      startY += 14;

      var boxY = startY;
      var mapPxW = Math.round(contentWidth * 1.6);
      var mapPxH = Math.round(mapDisplayHeight * 1.6);
      var mapDataUrl = await buildStaticMapImage(stops, mapPxW, mapPxH);

      if (mapDataUrl) {
        doc.addImage(mapDataUrl, "PNG", margin, boxY, contentWidth, mapDisplayHeight);
      } else {
        doc.setFillColor(241, 241, 241);
        doc.roundedRect(margin, boxY, contentWidth, mapDisplayHeight, 8, 8, "F");
        drawSchematicRoute(boxY, mapDisplayHeight, stops);
      }
      doc.setDrawColor(216, 226, 234);
      doc.roundedRect(margin, boxY, contentWidth, mapDisplayHeight, 8, 8, "S");

      doc.setTextColor(150, 150, 150);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      var caption = mapDataUrl
        ? "Mapa: © colaboradores do OpenStreetMap — siga a ordem numerada das paradas."
        : "Mapa esquemático, fora de escala — siga a ordem numerada das paradas.";
      doc.text(caption, margin, boxY + mapDisplayHeight + 14);

      return boxY + mapDisplayHeight + 28;
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

    y = await drawRouteMap(y + 6, data.route.stops);

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
