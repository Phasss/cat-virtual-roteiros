(function () {
  "use strict";

  var MARCO_ZERO = { lat: -8.0631715, lng: -34.8711583 };

  var deck = Array.isArray(window.LANDMARKS) ? window.LANDMARKS.slice() : [];
  var selectedIds = [];

  var gridEl = document.getElementById("picker-grid");
  var countEl = document.getElementById("picker-count");
  var countWrap = countEl ? countEl.closest(".picker-bar-count") : null;
  var finishBtn = document.getElementById("picker-finish");
  var deckSection = document.getElementById("swipe-section");
  var resultsSection = document.getElementById("swipe-results");

  var FALLBACK_ICON =
    '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';

  var CHECK_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

  function haversine(a, b) {
    var R = 6371000;
    var p1 = (a.lat * Math.PI) / 180;
    var p2 = (b.lat * Math.PI) / 180;
    var dp = ((b.lat - a.lat) * Math.PI) / 180;
    var dl = ((b.lng - a.lng) * Math.PI) / 180;
    var x = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  // ---------------------------------------------------------------------
  // Grid rendering
  // ---------------------------------------------------------------------

  function buildTile(item) {
    var tile = document.createElement("button");
    tile.type = "button";
    tile.className = "picker-tile";
    tile.dataset.id = item.id;
    tile.setAttribute("aria-pressed", "false");

    var frame = document.createElement("div");
    frame.className = "picker-tile-photo-frame";
    frame.style.background =
      "linear-gradient(150deg, " + item.accent + " 0%, color-mix(in srgb, " + item.accent + " 55%, black) 100%)";
    frame.innerHTML = '<div class="picker-tile-fallback-icon">' + FALLBACK_ICON + "</div>";

    var img = document.createElement("img");
    img.className = "picker-tile-photo";
    img.alt = item.name;
    img.dataset.slug = item.id;
    frame.appendChild(img);

    var scrim = document.createElement("div");
    scrim.className = "picker-tile-scrim";
    frame.appendChild(scrim);

    var text = document.createElement("div");
    text.className = "picker-tile-text";
    text.innerHTML = "<h4>" + item.name + "</h4><span>" + item.address + "</span>";
    frame.appendChild(text);

    var check = document.createElement("div");
    check.className = "picker-tile-check";
    check.innerHTML = CHECK_ICON;
    frame.appendChild(check);

    tile.appendChild(frame);
    tile.addEventListener("click", function () {
      toggle(item.id, tile);
    });

    if (window.CATPhotos) {
      window.CATPhotos.load(img, function () {
        img.remove();
      });
    }

    return tile;
  }

  function renderGrid() {
    if (!gridEl) return;
    if (!deck.length) {
      gridEl.innerHTML =
        '<p style="grid-column: 1 / -1; text-align:center; color: var(--text-muted);">Não foi possível carregar os lugares agora. Recarregue a página para tentar de novo.</p>';
      return;
    }
    gridEl.innerHTML = "";
    deck.forEach(function (item) {
      gridEl.appendChild(buildTile(item));
    });
  }

  function toggle(id, tile) {
    var pos = selectedIds.indexOf(id);
    var nowSelected;
    if (pos === -1) {
      selectedIds.push(id);
      nowSelected = true;
    } else {
      selectedIds.splice(pos, 1);
      nowSelected = false;
    }
    tile.classList.toggle("selected", nowSelected);
    tile.setAttribute("aria-pressed", nowSelected ? "true" : "false");
    updateBar();
  }

  function updateBar() {
    var n = selectedIds.length;
    countEl.textContent = String(n);
    if (countWrap) {
      countWrap.classList.remove("bump");
      // restart the bump animation every time the count changes
      void countWrap.offsetWidth;
      countWrap.classList.add("bump");
    }
    finishBtn.classList.toggle("visible", n > 0);
  }

  // ---------------------------------------------------------------------
  // Results
  // ---------------------------------------------------------------------

  function orderSelected() {
    var items = deck.filter(function (d) {
      return selectedIds.indexOf(d.id) !== -1;
    });
    var remaining = items.slice();
    var ordered = [];
    var current = MARCO_ZERO;
    while (remaining.length) {
      var bestIdx = 0;
      var bestDist = Infinity;
      remaining.forEach(function (it, i) {
        var d = haversine(current, it);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      });
      var next = remaining.splice(bestIdx, 1)[0];
      ordered.push({ item: next, leg: Math.round(bestDist) });
      current = next;
    }
    return ordered;
  }

  function buildResultStop(stop, i) {
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
      "<span>" + (i === 0 ? "a partir do Marco Zero" : "da parada anterior") + " · " + stop.legMeters + " m</span>" +
      "<span>" + stop.address + "</span>" +
      "</div>" +
      "</div>" +
      "</div>";
    var img = li.querySelector(".stop-art-photo");
    if (window.CATPhotos) window.CATPhotos.load(img);
    return li;
  }

  var mapInstance = null;

  function renderMap(stops) {
    var mapEl = document.getElementById("map");
    if (!mapEl || !window.L) return;
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
    var points = stops.map(function (s) {
      return { lat: s.lat, lng: s.lng, name: s.name };
    });
    mapInstance = L.map("map");
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(mapInstance);
    var latlngs = points.map(function (p) {
      return [p.lat, p.lng];
    });
    L.polyline(latlngs, { color: "#1B0CAD", weight: 3, dashArray: "1 8" }).addTo(mapInstance);
    points.forEach(function (p, i) {
      L.circleMarker([p.lat, p.lng], { radius: 8, color: "#ffffff", weight: 2, fillColor: "#FF00A5", fillOpacity: 1 })
        .addTo(mapInstance)
        .bindTooltip(String(i + 1) + ". " + p.name, { permanent: false });
    });
    mapInstance.fitBounds(latlngs, { padding: [24, 24] });
  }

  function showResults() {
    if (!selectedIds.length) return;

    deckSection.style.display = "none";
    resultsSection.classList.add("visible");

    var ordered = orderSelected();
    var stops = ordered.map(function (o) {
      return {
        id: o.item.id,
        name: o.item.name,
        address: o.item.address,
        lat: o.item.lat,
        lng: o.item.lng,
        description: o.item.description,
        legMeters: o.leg,
        accent: o.item.accent,
      };
    });
    var totalMeters = stops.reduce(function (sum, s) {
      return sum + s.legMeters;
    }, 0);
    var walkMinutes = Math.max(1, Math.round(totalMeters / 74));
    var visitMinutes = stops.length * 12;

    window.ROTEIRO_DATA = {
      id: "meu-roteiro",
      name: "Meu Roteiro",
      tagline: "Criado por você no CAT Virtual",
      landmarkIds: stops.map(function (s) {
        return s.id;
      }),
      route: {
        stops: stops,
        totalMeters: totalMeters,
        walkMinutes: walkMinutes,
        visitMinutes: visitMinutes,
      },
    };

    document.getElementById("swipe-stat-paradas").textContent = stops.length + " parada" + (stops.length === 1 ? "" : "s");
    document.getElementById("swipe-stat-tempo").textContent = "~" + (walkMinutes + visitMinutes) + " min no total";
    document.getElementById("swipe-stat-distancia").textContent = totalMeters + " m a pé";

    var list = document.getElementById("swipe-results-list");
    list.innerHTML = "";
    stops.forEach(function (stop, i) {
      list.appendChild(buildResultStop(stop, i));
    });

    renderMap(stops);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function restart() {
    selectedIds = [];
    window.ROTEIRO_DATA = null;
    resultsSection.classList.remove("visible");
    deckSection.style.display = "";
    renderGrid();
    updateBar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (finishBtn) finishBtn.addEventListener("click", showResults);
  var restartBtn = document.getElementById("swipe-restart");
  if (restartBtn) restartBtn.addEventListener("click", restart);

  renderGrid();
  updateBar();
})();
