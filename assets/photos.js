(function () {
  var EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

  function tryNext(img, i) {
    if (i >= EXTENSIONS.length) {
      var frame = img.closest(".suggestion-photo-frame");
      if (frame) {
        frame.remove();
      } else {
        img.remove();
      }
      return;
    }
    img.onerror = function () {
      tryNext(img, i + 1);
    };
    img.src = "assets/photos/" + img.dataset.slug + "." + EXTENSIONS[i];
  }

  document.querySelectorAll("img[data-slug]").forEach(function (img) {
    img.onload = function () {
      var art = img.closest(".stop-art");
      if (art) art.classList.add("has-photo");
    };
    tryNext(img, 0);
  });
})();
