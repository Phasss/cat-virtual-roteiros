(function () {
  "use strict";

  var MARCO_ZERO = { lat: -8.0631715, lng: -34.8711583 };
  var DRAG_THRESHOLD = 110;
  var VISIBLE_STACK = 3;

  var deck = (window.LANDMARKS || []).slice();
  var index = 0;
  var likedIds = [];
  var history = []; // { id, liked }
  var isAnimating = false;

  var stackEl = document.getElementById("swipe-stack");
  var progressText = document.getElementById("swipe-progress-text");
  var progressFill = document.getElementById("swipe-progress-fill");
  var undoBtn = document.getElementById("swipe-undo");
  var nopeBtn = document.getElementById("swipe-nope");
  var likeBtn = document.getElementById("swipe-like");
  var finishEarly = document.getElementById("swipe-finish-early");
  var deckSection = document.getElementById("swipe-section");
  var resultsSection = document.getElementById("swipe-results");

  var FALLBACK_ICON =
    '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';

  function haversine(a, b) {
    var R = 6371000;
    var p1 = (a.lat * Math.PI) / 180;
    var p2 = (b.lat * Math.PI) / 180;
    var dp = ((b.lat - a.lat) * Math.PI) / 180;
    var dl = ((b.lng - a.lng) * Math.PI) / 180;
    var x = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  // ---------------------------------------------------------------------
  // Deck rendering
  // ---------------------------------------------------------------------

  function updateProgress() {
    var total = deck.length;
    var done = Math.min(index, total);
    progressText.textContent = done + " de " + total + " · " + likedIds.length + " escolhido" + (likedIds.length === 1 ? "" : "s");
    progressFill.style.width = (total ? (done / total) * 100 : 0) + "%";
    undoBtn.disabled = history.length === 0;
    finishEarly.style.display = likedIds.length > 0 && index < total ? "inline-flex" : "none";
  }

  function buildCard(item, stackPos) {
    var card = document.createElement("div");
    card.className = "swipe-card";
    card.dataset.id = item.id;
    card.style.transform =
      "translateY(" + stackPos * 10 + "px) scale(" + (1 - stackPos * 0.045) + ")";
    card.style.zIndex = String(100 - stackPos);

    var fallback = document.createElement("div");
    fallback.className = "swipe-card-fallback-bg";
    fallback.style.position = "absolute";
    fallback.style.inset = "0";
    fallback.style.background =
      "linear-gradient(150deg, " + item.accent + " 0%, color-mix(in srgb, " + item.accent + " 55%, black) 100%)";
    fallback.innerHTML = '<div class="swipe-card-fallback-icon">' + FALLBACK_ICON + "</div>";
    card.appendChild(fallback);

    var img = document.createElement("img");
    img.className = "swipe-card-photo";
    img.alt = item.name;
    img.dataset.slug = item.id;
    card.appendChild(img);

    var scrim = document.createElement("div");
    scrim.className = "swipe-card-scrim";
    card.appendChild(scrim);

    var text = document.createElement("div");
    text.className = "swipe-card-text";
    text.innerHTML =
      "<h3>" + item.name + "</h3>" +
      "<p>" + item.teaser + "</p>" +
      '<div class="swipe-card-address">' + item.address + "</div>";
    card.appendChild(text);

    var nope = document.createElement("div");
    nope.className = "swipe-stamp nope";
    nope.textContent = "Pular";
    card.appendChild(nope);

    var like = document.createElement("div");
    like.className = "swipe-stamp like";
    like.textContent = "Quero";
    card.appendChild(like);

    if (window.CATPhotos) {
      window.CATPhotos.load(img, function () {
        img.remove();
      });
    }

    return card;
  }

  function renderStack() {
    stackEl.innerHTML = "";
    if (index >= deck.length) {
      updateProgress();
      showResults();
      return;
    }
    var slice = deck.slice(index, index + VISIBLE_STACK);
    // append back-to-front so the first (top) card is last in DOM (on top)
    for (var i = slice.length - 1; i >= 0; i--) {
      var card = buildCard(slice[i], i);
      stackEl.appendChild(card);
      if (i === 0) wireDrag(card);
    }
    updateProgress();
  }

  // ---------------------------------------------------------------------
  // Drag handling (pointer events cover mouse + touch)
  // ---------------------------------------------------------------------

  function wireDrag(card) {
    var startX = 0;
    var startY = 0;
    var dx = 0;
    var dy = 0;
    var dragging = false;
    var likeStamp = card.querySelector(".swipe-stamp.like");
    var nopeStamp = card.querySelector(".swipe-stamp.nope");

    function onDown(e) {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      card.style.transition = "none";
      try {
        card.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
    }

    function onMove(e) {
      if (!dragging) return;
      dx = e.clientX - startX;
      dy = e.clientY - startY;
      var rotate = dx / 18;
      card.style.transform = "translate(" + dx + "px, " + dy * 0.3 + "px) rotate(" + rotate + "deg)";
      likeStamp.style.opacity = String(clamp(dx / 100, 0, 1));
      nopeStamp.style.opacity = String(clamp(-dx / 100, 0, 1));
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      if (isAnimating) {
        dx = 0;
        dy = 0;
        return;
      }
      if (Math.abs(dx) > DRAG_THRESHOLD) {
        commit(dx > 0 ? "like" : "nope", card);
      } else {
        card.style.transition = "transform 0.25s ease";
        card.style.transform = "translateY(0px) scale(1)";
        likeStamp.style.opacity = "0";
        nopeStamp.style.opacity = "0";
      }
      dx = 0;
      dy = 0;
    }

    card.addEventListener("pointerdown", onDown);
    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerup", onUp);
    card.addEventListener("pointercancel", onUp);
  }

  function commit(decision, card) {
    if (isAnimating) return;
    var item = deck[index];
    history.push({ id: item.id, liked: decision === "like" });
    if (decision === "like") likedIds.push(item.id);

    if (card) {
      isAnimating = true;
      var flyX = decision === "like" ? window.innerWidth : -window.innerWidth;
      card.style.transition = "transform 0.35s ease";
      card.style.transform = "translate(" + flyX + "px, -40px) rotate(" + (decision === "like" ? 30 : -30) + "deg)";
      card.addEventListener(
        "transitionend",
        function () {
          isAnimating = false;
          index++;
          renderStack();
        },
        { once: true }
      );
    } else {
      index++;
      renderStack();
    }
  }

  function decide(decision) {
    if (isAnimating || index >= deck.length) return;
    var topCard = stackEl.querySelector('.swipe-card[data-id="' + deck[index].id + '"]');
    commit(decision, topCard);
  }

  function undo() {
    if (isAnimating) return;
    var last = history.pop();
    if (!last) return;
    if (last.liked) {
      var pos = likedIds.lastIndexOf(last.id);
      if (pos !== -1) likedIds.splice(pos, 1);
    }
    index = Math.max(0, index - 1);
    if (resultsSection.classList.contains("visible")) {
      resultsSection.classList.remove("visible");
      deckSection.style.display = "";
    }
    renderStack();
  }

  nopeBtn.addEventListener("click", function () {
    decide("nope");
  });
  likeBtn.addEventListener("click", function () {
    decide("like");
  });
  undoBtn.addEventListener("click", undo);
  finishEarly.addEventListener("click", function () {
    showResults();
  });

  document.addEventListener("keydown", function (e) {
    if (resultsSection.classList.contains("visible")) return;
    if (e.key === "ArrowLeft") decide("nope");
    if (e.key === "ArrowRight") decide("like");
  });

  // ---------------------------------------------------------------------
  // Results
  // ---------------------------------------------------------------------

  function orderLiked() {
    var items = deck.filter(function (d) {
      return likedIds.indexOf(d.id) !== -1;
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
    L.polyline(latlngs, { color: "#1B2A6B", weight: 3, dashArray: "1 8" }).addTo(mapInstance);
    points.forEach(function (p, i) {
      L.circleMarker([p.lat, p.lng], { radius: 8, color: "#ffffff", weight: 2, fillColor: "#E91E8C", fillOpacity: 1 })
        .addTo(mapInstance)
        .bindTooltip(String(i + 1) + ". " + p.name, { permanent: false });
    });
    mapInstance.fitBounds(latlngs, { padding: [24, 24] });
  }

  function showResults() {
    deckSection.style.display = "none";
    resultsSection.classList.add("visible");

    var emptyEl = document.getElementById("swipe-results-empty");
    var contentEl = document.getElementById("swipe-results-content");

    if (likedIds.length === 0) {
      emptyEl.style.display = "block";
      contentEl.style.display = "none";
      return;
    }
    emptyEl.style.display = "none";
    contentEl.style.display = "block";

    var ordered = orderLiked();
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
  }

  function restart() {
    index = 0;
    likedIds = [];
    history = [];
    isAnimating = false;
    window.ROTEIRO_DATA = null;
    resultsSection.classList.remove("visible");
    deckSection.style.display = "";
    renderStack();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.getElementById("swipe-restart").addEventListener("click", restart);
  var restartFromEmpty = document.getElementById("swipe-restart-empty");
  if (restartFromEmpty) restartFromEmpty.addEventListener("click", restart);

  renderStack();
})();
