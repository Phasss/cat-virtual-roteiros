// Carrega o roteiro montado no totem CAT Virtual. O totem não guarda nada
// aqui: as paradas vêm no próprio link do QR code, já na ordem do passeio,
// como ids de assets/landmarks.js separados por vírgula —
// roteiro.html?p=praca-do-marco-zero,rua-do-bom-jesus,paco-do-frevo
//
// Por isso um id de landmarks.js nunca deve mudar nem ser reaproveitado:
// os links já gerados pelo totem continuam apontando para ele.
(function () {
  "use strict";

  var MARCO_ZERO = { lat: -8.0631715, lng: -34.8711583 };
  // Mesmos parâmetros e arredondamentos do totem (src/attendance/routeUtils.ts),
  // pra o resumo no celular bater com o que a pessoa viu na tela.
  var WALK_METERS_PER_MINUTE = 75;
  var VISIT_MINUTES_PER_STOP = 12;

  var byId = {};
  (Array.isArray(window.LANDMARKS) ? window.LANDMARKS : []).forEach(function (l) {
    byId[l.id] = l;
  });

  function haversine(a, b) {
    var R = 6371000;
    var p1 = (a.lat * Math.PI) / 180;
    var p2 = (b.lat * Math.PI) / 180;
    var dp = ((b.lat - a.lat) * Math.PI) / 180;
    var dl = ((b.lng - a.lng) * Math.PI) / 180;
    var x = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  // Ids desconhecidos ou repetidos são ignorados, mantendo a ordem do link.
  function readStopIds() {
    var raw = new URLSearchParams(window.location.search).get("p") || "";
    var seen = {};
    return raw
      .split(",")
      .map(function (id) {
        return id.trim();
      })
      .filter(function (id) {
        if (!byId[id] || seen[id]) return false;
        seen[id] = true;
        return true;
      });
  }

  function buildStops(ids) {
    var current = MARCO_ZERO;
    return ids.map(function (id) {
      var l = byId[id];
      var leg = haversine(current, l);
      current = l;
      return {
        id: l.id,
        name: l.name,
        address: l.address,
        lat: l.lat,
        lng: l.lng,
        description: l.description,
        legMeters: Math.round(leg),
        exactLegMeters: leg,
        accent: l.accent,
      };
    });
  }

  function directionsUrl(stop) {
    return "https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=" + stop.lat + "," + stop.lng;
  }

  function legLabel(stop, i) {
    if (i === 0 && stop.legMeters === 0) return "ponto de partida";
    return (i === 0 ? "a partir do Marco Zero" : "da parada anterior") + " · " + stop.legMeters + " m";
  }

  function buildStop(stop, i) {
    var li = document.createElement("li");
    li.className = "stop";
    li.innerHTML =
      '<span class="stop-number">' + (i + 1) + "</span>" +
      '<div class="stop-body">' +
      '<div class="stop-art" style="background: linear-gradient(150deg, ' +
      stop.accent +
      " 0%, color-mix(in srgb, " +
      stop.accent +
      ' 55%, black) 100%);">' +
      '<img class="stop-art-photo" data-slug="' +
      stop.id +
      '" alt="' +
      stop.name +
      '">' +
      '<svg class="stop-art-glyph" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>' +
      "</div>" +
      '<div class="stop-text">' +
      "<h4>" + stop.name + "</h4>" +
      '<p class="desc">' + stop.description + "</p>" +
      '<div class="stop-meta">' +
      "<span>" + legLabel(stop, i) + "</span>" +
      "<span>" + stop.address + "</span>" +
      "</div>" +
      '<a class="stop-directions" target="_blank" rel="noopener" href="' + directionsUrl(stop) + '">Como chegar ↗</a>' +
      "</div>" +
      "</div>";
    var img = li.querySelector(".stop-art-photo");
    if (window.CATPhotos) window.CATPhotos.load(img);
    return li;
  }

  function renderMap(stops) {
    var mapEl = document.getElementById("map");
    if (!mapEl || !window.L) return;
    var map = L.map("map");
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    var latlngs = stops.map(function (s) {
      return [s.lat, s.lng];
    });
    L.polyline(latlngs, { color: "#1B0CAD", weight: 3, dashArray: "1 8" }).addTo(map);
    stops.forEach(function (s, i) {
      L.circleMarker([s.lat, s.lng], { radius: 8, color: "#ffffff", weight: 2, fillColor: "#FF00A5", fillOpacity: 1 })
        .addTo(map)
        .bindTooltip(String(i + 1) + ". " + s.name, { permanent: false });
    });
    if (latlngs.length === 1) {
      map.setView(latlngs[0], 17);
    } else {
      map.fitBounds(latlngs, { padding: [24, 24] });
    }
  }

  function render() {
    var ids = readStopIds();
    if (!ids.length) {
      document.body.classList.add("roteiro-invalido");
      return;
    }

    var stops = buildStops(ids);
    var exactTotal = stops.reduce(function (sum, s) {
      return sum + s.exactLegMeters;
    }, 0);
    var totalMeters = Math.round(exactTotal);
    var walkMinutes = Math.round(exactTotal / WALK_METERS_PER_MINUTE);
    var visitMinutes = stops.length * VISIT_MINUTES_PER_STOP;

    // Lido por assets/pdf.js no botão de baixar.
    window.ROTEIRO_DATA = {
      id: "meu-roteiro",
      name: "Meu Roteiro",
      tagline: "Montado por você no totem CAT Virtual",
      landmarkIds: ids,
      route: {
        stops: stops,
        totalMeters: totalMeters,
        walkMinutes: walkMinutes,
        visitMinutes: visitMinutes,
      },
    };

    document.getElementById("stat-paradas").textContent = stops.length + " parada" + (stops.length === 1 ? "" : "s");
    document.getElementById("stat-tempo").textContent = "~" + (walkMinutes + visitMinutes) + " min no total";
    document.getElementById("stat-distancia").textContent = totalMeters + " m a pé";

    var list = document.getElementById("roteiro-list");
    stops.forEach(function (stop, i) {
      list.appendChild(buildStop(stop, i));
    });

    renderMap(stops);
  }

  render();
})();
