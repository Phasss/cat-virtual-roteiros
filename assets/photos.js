(function () {
  var EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

  function tryNext(img, i, onFail) {
    if (i >= EXTENSIONS.length) {
      if (onFail) {
        onFail(img);
      } else {
        var frame = img.closest(".suggestion-photo-frame");
        if (frame) {
          frame.remove();
        } else {
          img.remove();
        }
      }
      return;
    }
    img.onerror = function () {
      tryNext(img, i + 1, onFail);
    };
    img.src = "assets/photos/" + img.dataset.slug + "." + EXTENSIONS[i];
  }

  function load(img, onFail) {
    img.onload = function () {
      var art = img.closest(".stop-art");
      if (art) art.classList.add("has-photo");
      if (img.dataset.onPhotoLoaded) {
        var fn = window[img.dataset.onPhotoLoaded];
        if (typeof fn === "function") fn(img);
      }
    };
    tryNext(img, 0, onFail);
  }

  window.CATPhotos = { load: load };

  document.querySelectorAll("img[data-slug]").forEach(function (img) {
    load(img);
  });
})();
