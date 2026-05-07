(function () {
  const galleries = {
    languagecommand: {
      title: "LanguageCommand.com",
      kicker: "Product screenshots",
      slides: [
        {
          src: "/assets/projects/languagecommand/home-signup.png",
          alt: "LanguageCommand landing page with app screenshots and signup form",
          caption: "LanguageCommand: an intelligent, interactive, and multimodal AI-powered foreign language learning platform."
        },
        {
          src: "/assets/projects/languagecommand/why-it-works.png",
          alt: "LanguageCommand marketing section with proof, voice, and curriculum screenshots",
          caption: "The method: proof-based practice, voice work, transliteration, translation, and curriculum depth."
        },
        {
          src: "/assets/projects/languagecommand/progress-desktop.png",
          alt: "Hebrew Command daily progress dashboard with week-by-week curriculum cards",
          caption: "Progress tracker with daily proof requirements across listening, speaking, reading, typing, handwriting, and review. AI voice and speech models analyze the user's pronunciation, and image models analyze the user's handwriting according to modern language-specific norms for print and cursive."
        },
        {
          src: "/assets/projects/languagecommand/proof-writing-lab.png",
          alt: "LanguageCommand writing lab with selected day progress and Hebrew writing prompt",
          caption: "Writing lab for original production of written work, assessed before it counts as proof."
        },
        {
          src: "/assets/projects/languagecommand/voice-coach.png",
          alt: "LanguageCommand voice coach with audio waveform, prompt tabs, Hebrew sentence, transliteration, and recording button",
          caption: "Voice Coach practice loop with audio, script, transliteration, translation, and recorded reply."
        }
      ]
    },
    "local-library": {
      title: "Self-hosted research library",
      kicker: "Client build screenshots",
      slides: [
        {
          src: "/assets/projects/local-library/source-detail.png",
          alt: "Local Library source detail view with source filters, key claims, curation metadata, and retrieval chunks",
          caption: "Local Library viewer with sources, processed retrieval chunks, rapid intelligent semantic search functionality, AI-generated summaries and outlines, bookmarked items, and links to stored original source files."
        },
        {
          src: "/assets/projects/local-library/source-browser.png",
          alt: "Local Library source browser modal with filters, source categories, and pinned items",
          caption: "Source Browser for quick browsing of the full library, with filters and sorting options for labels, filetypes and key document metadata."
        }
      ]
    }
  };

  const lightbox = document.querySelector("[data-carousel-lightbox]");
  if (!lightbox) return;

  const image = lightbox.querySelector("[data-carousel-image]");
  const title = lightbox.querySelector("[data-carousel-title]");
  const kicker = lightbox.querySelector("[data-carousel-kicker]");
  const caption = lightbox.querySelector("[data-carousel-caption]");
  const count = lightbox.querySelector("[data-carousel-count]");
  const previous = lightbox.querySelector("[data-carousel-prev]");
  const next = lightbox.querySelector("[data-carousel-next]");
  const closeButtons = lightbox.querySelectorAll("[data-carousel-close]");

  let activeGallery = null;
  let activeIndex = 0;
  let lastTrigger = null;

  function renderSlide() {
    if (!activeGallery) return;
    const slide = activeGallery.slides[activeIndex];
    title.textContent = activeGallery.title;
    kicker.textContent = activeGallery.kicker;
    image.src = slide.src;
    image.alt = slide.alt;
    caption.textContent = slide.caption;
    count.textContent = `${activeIndex + 1} / ${activeGallery.slides.length}`;
  }

  function openCarousel(key, trigger) {
    const gallery = galleries[key];
    if (!gallery) return;
    activeGallery = gallery;
    activeIndex = 0;
    lastTrigger = trigger;
    renderSlide();
    lightbox.hidden = false;
    document.body.classList.add("carousel-open");
    next.focus();
  }

  function closeCarousel() {
    lightbox.hidden = true;
    document.body.classList.remove("carousel-open");
    activeGallery = null;
    activeIndex = 0;
    image.removeAttribute("src");
    if (lastTrigger) lastTrigger.focus();
  }

  function moveCarousel(direction) {
    if (!activeGallery) return;
    activeIndex = (activeIndex + direction + activeGallery.slides.length) % activeGallery.slides.length;
    renderSlide();
  }

  document.querySelectorAll("[data-carousel]").forEach((trigger) => {
    trigger.addEventListener("click", () => openCarousel(trigger.dataset.carousel, trigger));
  });

  previous.addEventListener("click", () => moveCarousel(-1));
  next.addEventListener("click", () => moveCarousel(1));
  closeButtons.forEach((button) => button.addEventListener("click", closeCarousel));

  document.addEventListener("keydown", (event) => {
    if (!activeGallery) return;
    if (event.key === "Escape") closeCarousel();
    if (event.key === "ArrowLeft") moveCarousel(-1);
    if (event.key === "ArrowRight") moveCarousel(1);
  });
})();

(function () {
  const modal = document.querySelector("[data-image-lightbox-modal]");
  if (!modal) return;

  const image = modal.querySelector("[data-image-lightbox-image]");
  const closeButtons = modal.querySelectorAll("[data-image-lightbox-close]");
  let lastTrigger = null;

  function openImageLightbox(trigger) {
    lastTrigger = trigger;
    image.src = trigger.dataset.lightboxSrc || trigger.getAttribute("href");
    image.alt = trigger.dataset.lightboxAlt || trigger.querySelector("img")?.alt || "";
    modal.hidden = false;
    document.body.classList.add("carousel-open");
    modal.querySelector(".image-lightbox-close").focus();
  }

  function closeImageLightbox() {
    modal.hidden = true;
    document.body.classList.remove("carousel-open");
    image.removeAttribute("src");
    if (lastTrigger) lastTrigger.focus();
    lastTrigger = null;
  }

  document.querySelectorAll("[data-image-lightbox]").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      openImageLightbox(trigger);
    });
  });

  closeButtons.forEach((button) => button.addEventListener("click", closeImageLightbox));

  document.addEventListener("keydown", (event) => {
    if (modal.hidden || event.key !== "Escape") return;
    closeImageLightbox();
  });
})();

(function () {
  const carousels = document.querySelectorAll("[data-auto-carousel]");
  if (!carousels.length) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  carousels.forEach((carousel) => {
    const slides = Array.from(carousel.querySelectorAll(".auto-slide"));
    if (slides.length < 2) return;

    let activeIndex = Math.max(0, slides.findIndex((slide) => slide.classList.contains("is-active")));
    let timer = null;

    function showSlide(index) {
      slides[activeIndex].classList.remove("is-active");
      activeIndex = (index + slides.length) % slides.length;
      slides[activeIndex].classList.add("is-active");
    }

    function start() {
      if (reduceMotion || timer || document.hidden) return;
      timer = window.setInterval(() => showSlide(activeIndex + 1), 4200);
    }

    function stop() {
      if (!timer) return;
      window.clearInterval(timer);
      timer = null;
    }

    carousel.addEventListener("mouseenter", stop);
    carousel.addEventListener("mouseleave", start);
    carousel.addEventListener("focusin", stop);
    carousel.addEventListener("focusout", start);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
      else start();
    });

    start();
  });
})();
