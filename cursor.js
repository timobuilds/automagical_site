/**
 * Custom wand cursor: positions wand.png at pointer so it's always visible.
 */
(function () {
    var el = document.getElementById("custom-cursor");
    if (!el) return;

    function show() {
        el.classList.remove("is-hidden");
    }
    function hide() {
        el.classList.add("is-hidden");
    }
    function move(x, y) {
        el.style.left = x + "px";
        el.style.top = y + "px";
    }

    document.addEventListener("mousemove", function (e) {
        move(e.clientX, e.clientY);
        show();
    });
    document.addEventListener("mouseleave", hide);
    document.addEventListener("mouseenter", show);

    // Touch: show cursor at touch point while touching
    document.addEventListener("touchstart", function (e) {
        if (e.touches.length) {
            move(e.touches[0].clientX, e.touches[0].clientY);
            show();
        }
    });
    document.addEventListener("touchmove", function (e) {
        if (e.touches.length) move(e.touches[0].clientX, e.touches[0].clientY);
    });
    document.addEventListener("touchend", function (e) {
        if (!e.touches.length) hide();
    });
})();
