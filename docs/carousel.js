const carousel = document.querySelector("[data-carousel]");

if (carousel) {
  const viewport = carousel.querySelector("[data-carousel-viewport]");
  const slides = [...carousel.querySelectorAll(".carousel-slide")];
  const current = document.querySelector("[data-carousel-current]");
  const previous = carousel.querySelector("[data-carousel-previous]");
  const next = carousel.querySelector("[data-carousel-next]");
  let activeIndex = 0;
  let scrollTimer;
  let viewportWidth = viewport.clientWidth;

  const updateControls = () => {
    previous.disabled = activeIndex === 0;
    next.disabled = activeIndex === slides.length - 1;
  };

  const showSlide = (index) => {
    activeIndex = Math.max(0, Math.min(slides.length - 1, index));
    viewport.scrollTo({
      left: activeIndex * viewport.clientWidth,
      behavior: "smooth",
    });
    current.textContent = String(activeIndex + 1);
    updateControls();
  };

  previous.addEventListener("click", () => showSlide(activeIndex - 1));
  next.addEventListener("click", () => showSlide(activeIndex + 1));

  viewport.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    showSlide(activeIndex + (event.key === "ArrowRight" ? 1 : -1));
  });

  viewport.addEventListener("scroll", () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      activeIndex = Math.max(
        0,
        Math.min(
          slides.length - 1,
          Math.round(viewport.scrollLeft / viewport.clientWidth),
        ),
      );
      current.textContent = String(activeIndex + 1);
      updateControls();
    }, 80);
  });

  new ResizeObserver(() => {
    if (viewport.clientWidth === viewportWidth) return;
    clearTimeout(scrollTimer);
    viewportWidth = viewport.clientWidth;
    viewport.scrollTo({ left: activeIndex * viewportWidth, behavior: "auto" });
  }).observe(viewport);

  updateControls();
}