(() => {
  "use strict";

  // Helpers
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const debounce = (fn, ms) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; };

  const refreshLenis = () => {
    if (window.lenis && typeof window.lenis.resize === "function") window.lenis.resize();
  };

  const refreshLayout = () => {
    refreshLenis();
    if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
  };

  let introReady = false;
  const introQueue = [];

  const onIntroReady = (fn) => {
    if (introReady) { fn(); return; }
    introQueue.push(fn);
  };

  const markIntroReady = () => {
    if (introReady) return;
    introReady = true;
    introQueue.splice(0).forEach((fn) => fn());
  };

  const initLayoutWatcher = () => {
    const refresh = debounce(refreshLayout, 150);

    window.addEventListener("load", refresh);
    document.fonts?.ready.then(refresh);

    if (!("ResizeObserver" in window)) return;

    let last = document.body.offsetHeight;
    new ResizeObserver(() => {
      const height = document.body.offsetHeight;
      if (height === last) return;
      last = height;
      refresh();
    }).observe(document.body);
  };

  const createScrollLock = (lenis) => {
    const locks = new Set();

    const apply = () => {
      if (locks.size) {
        const scrollbar = window.innerWidth - document.documentElement.clientWidth;
        document.documentElement.style.setProperty("--scrollbar-width", `${scrollbar}px`);
        document.body.classList.add("no-scroll");
        lenis?.stop?.();
      } else {
        document.body.classList.remove("no-scroll");
        document.documentElement.style.setProperty("--scrollbar-width", "0px");
        lenis?.start?.();
      }
    };

    return {
      lock: (key) => {
        if (!key) return;
        locks.add(key);
        apply();
      },
      unlock: (key) => {
        if (!key) return;
        locks.delete(key);
        apply();
      },
      reset: () => {
        locks.clear();
        apply();
      },
      has: (key) => locks.has(key),
    };
  };

  const state = {
    multiplier: 1,
    swipers: {},
  };

  // ======================
  // Lenis
  // ======================
  const initLenis = () => {
    if (typeof Lenis === "undefined") return null;
    const useGsapTicker = typeof gsap !== "undefined";
    const lenis = new Lenis({ autoRaf: !useGsapTicker });
    window.lenis = lenis;

    if (useGsapTicker) {
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
      if (typeof ScrollTrigger !== "undefined") {
        lenis.on("scroll", ScrollTrigger.update);
      }
    }

    return lenis;
  };

  // ======================
  // Multiplier / s()
  // ======================
  const getWidthMultiplier = () => {
    const w = window.innerWidth;
    const minSide = Math.min(window.innerWidth, window.innerHeight);

    if (w <= 767) return minSide / 375;
    if (w <= 1024) return minSide / 768;
    return window.innerWidth / 1440;
  };

  const updateMultiplier = () => {
    state.multiplier = getWidthMultiplier();
  };

  const s = (value) => value * state.multiplier;

  // ======================
  // Header
  // ======================
  const initHeader = () => {
    const header = $(".header");
    if (!header) return;

    const toggle = () => {
      header.classList.toggle("scrolled", window.scrollY > 10);
    };

    toggle();
    window.addEventListener("scroll", toggle, { passive: true });
  };

  // ======================
  // Burger
  // ======================
  const initBurger = ({ scrollLock }) => {
    const burger = $(".header__burger");
    const mobile = $(".header__mobile");
    const closeBtn = $(".header__mobile-close");
    if (!burger || !mobile) return;

    const open = () => {
      mobile.classList.add("is-open");
      burger.classList.add("header__burger--open");
      scrollLock?.lock?.("mobile-menu");
    };

    const close = () => {
      mobile.classList.remove("is-open");
      burger.classList.remove("header__burger--open");
      scrollLock?.unlock?.("mobile-menu");
    };

    burger.addEventListener("click", () => {
      mobile.classList.contains("is-open") ? close() : open();
    });

    closeBtn?.addEventListener("click", close);

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && mobile.classList.contains("is-open")) close();
    });

    // Аккордеон: одновременно открыт только один пункт
    const mobileItems = $$(".header__mobile-item--has-drop");
    const mobileSubItems = $$(".header__mobile-sub-item");

    const closeSubItems = () => {
      mobileSubItems.forEach((el) => el.classList.remove("header__mobile-sub-item--open"));
    };

    $$(".header__mobile-trigger").forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const item = trigger.closest(".header__mobile-item--has-drop");
        if (!item) return;

        const willOpen = !item.classList.contains("header__mobile-item--open");
        mobileItems.forEach((el) => el.classList.remove("header__mobile-item--open"));
        closeSubItems();
        if (willOpen) item.classList.add("header__mobile-item--open");
      });
    });

    // Вложенные аккордеоны (группы внутри «Платформы»)
    $$(".header__mobile-sub-trigger").forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const item = trigger.closest(".header__mobile-sub-item");
        if (!item) return;

        const willOpen = !item.classList.contains("header__mobile-sub-item--open");
        closeSubItems();
        if (willOpen) item.classList.add("header__mobile-sub-item--open");
      });
    });

    return { open, close };
  };

  // ======================
  // Выпадающие меню в шапке
  // ======================
  const initHeaderDropdown = ({ scrollLock } = {}) => {
    const lang = $(".header__lang");
    const groups = [
      ...$$(".header__menu-item--has-drop").map((el) => ({ el, cls: "header__menu-item--open" })),
      ...(lang ? [{ el: lang, cls: "header__lang--open" }] : []),
    ];
    if (!groups.length) return;

    let timer;

    const closeAll = () => {
      clearTimeout(timer);
      groups.forEach((g) => g.el.classList.remove(g.cls));
      scrollLock?.unlock?.("mega-menu");
    };

    const open = (group) => {
      closeAll();
      group.el.classList.add(group.cls);
      if (group.el.classList.contains("header__menu-item--mega")) scrollLock?.lock?.("mega-menu");
    };

    groups.forEach((group) => {
      group.el.addEventListener("mouseenter", () => open(group));

      group.el.addEventListener("mouseleave", () => {
        clearTimeout(timer);
        timer = setTimeout(closeAll, 200);
      });
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".header__menu-item--has-drop") && !e.target.closest(".header__lang")) closeAll();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAll();
    });
  };

  // ======================
  // Переключатель языков
  // ======================
  const initLang = () => {
    const links = $$("[data-lang]");
    if (!links.length) return;

    const current = $$(".header__lang-current");

    links.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const lang = link.dataset.lang;
        if (!lang) return;

        links.forEach((l) => l.classList.toggle("is-active", l.dataset.lang === lang));
        current.forEach((el) => (el.textContent = lang));
        $(".header__lang")?.classList.remove("header__lang--open");
      });
    });
  };

  // ======================
  // Табы
  // ======================
  const initTabs = () => {
    $$("[data-tabs]").forEach((root) => {
      const tabs = $$("[data-tab]", root);
      const panels = $$("[data-tab-panel]", root);
      if (!tabs.length || !panels.length) return;

      tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
          const name = tab.dataset.tab;
          tabs.forEach((t) => t.classList.toggle("is-active", t === tab));
          panels.forEach((p) => p.classList.toggle("is-active", p.dataset.tabPanel === name));
        });
      });
    });
  };

  // ======================
  // Подвал
  // ======================
  const initFooter = () => {
    // колонки-аккордеоны на мобилке, на десктопе списки открыты всегда
    $$("button.footer__col-title").forEach((trigger) => {
      trigger.addEventListener("click", () => {
        trigger.closest(".footer__col")?.classList.toggle("is-open");
      });
    });
  };

  // ======================
  // FAQ
  // ======================
  const initFaq = () => {
    const faq = $(".faq");
    if (!faq) return;

    const items = $$(".faq__item", faq);
    if (!items.length) return;

    const current = $(".faq__counter-current", faq);
    const total = $(".faq__counter-total", faq);
    const desktop = window.matchMedia("(min-width: 768px)");

    if (total) total.textContent = items.length;

    const setActive = (index) => {
      items.forEach((item, i) => item.classList.toggle("is-open", i === index));
      if (current) current.textContent = index + 1;
    };

    const getActive = () => items.findIndex((item) => item.classList.contains("is-open"));

    items.forEach((item, index) => {
      $(".faq__question", item)?.addEventListener("click", () => {
        if (!desktop.matches && item.classList.contains("is-open")) {
          item.classList.remove("is-open");
          return;
        }
        setActive(index);
      });
    });

    $(".faq__arrow--prev", faq)?.addEventListener("click", () => {
      const active = getActive();
      setActive((active <= 0 ? items.length : active) - 1);
    });

    $(".faq__arrow--next", faq)?.addEventListener("click", () => {
      setActive((getActive() + 1) % items.length);
    });
  };

  // ======================
  // Swipers
  // ======================
  const initSwipers = () => {
    if (typeof Swiper === "undefined") return;

    const mobile = window.matchMedia("(max-width: 767px)");
    const pad = (n) => (n < 10 ? `0${n}` : n);

    const mobileSwiper = (key, selector, options) => {
      const el = $(selector);
      if (!el) return;

      const sync = () => {
        if (mobile.matches && !state.swipers[key]) {
          state.swipers[key] = new Swiper(el, options);
        } else if (!mobile.matches && state.swipers[key]) {
          state.swipers[key].destroy(true, true);
          state.swipers[key] = null;
        }
      };

      sync();
      mobile.addEventListener("change", sync);
    };

    const teams = $(".teams__swiper");
    if (teams) {
      state.swipers.teams = new Swiper(teams, {
        slidesPerView: 1.3,
        spaceBetween: s(16),
        grabCursor: true,
        pagination: {
          el: ".teams__counter",
          type: "fraction",
        },
        navigation: {
          prevEl: ".teams__arrow--prev",
          nextEl: ".teams__arrow--next",
        },
        breakpoints: {
          768: {
            slidesPerView: 2.5,
          },
          1025: {
            slidesPerView: 4,
            spaceBetween: s(24),
          },
        },
      });
    }


    const caseGallery = $(".cases-inner__gallery");
    if (caseGallery) {
      const caseSlides = $$(".swiper-slide", caseGallery).length;

      state.swipers.caseGallery = new Swiper(caseGallery, {
        slidesPerView: 1.1,
        spaceBetween: s(16),
        grabCursor: true,
        pagination: {
          el: ".cases-inner__counter",
          type: "fraction",
          formatFractionTotal: () => caseSlides,
        },
        navigation: {
          prevEl: ".cases-inner__arrow--prev",
          nextEl: ".cases-inner__arrow--next",
        },
        breakpoints: {
          768: {
            slidesPerView: 2.15,
            spaceBetween: s(20),
          },
        },
      });
    }

    const archOther = $(".arch__swiper");
    if (archOther) {
      state.swipers.archOther = new Swiper(archOther, {
        slidesPerView: 1.2,
        spaceBetween: s(16),
        grabCursor: true,
        breakpoints: {
          768: {
            slidesPerView: 2.5,
            spaceBetween: s(20),
          },
          1025: {
            slidesPerView: 4,
            spaceBetween: s(20),
          },
        },
      });
    }

    mobileSwiper("advantages", ".advantages__swiper", {
      slidesPerView: 1.25,
      spaceBetween: s(16),
      grabCursor: true,
      pagination: {
        el: ".advantages__pagination",
        type: "fraction",
        formatFractionCurrent: pad,
        formatFractionTotal: pad,
      },
    });

    mobileSwiper("models", ".models__swiper", {
      slidesPerView: 1.15,
      spaceBetween: s(16),
      grabCursor: true,
      pagination: {
        el: ".models__pagination",
        type: "fraction",
        formatFractionCurrent: pad,
        formatFractionTotal: pad,
      },
    });

    mobileSwiper("services", ".services__swiper", {
      slidesPerView: 1.1,
      spaceBetween: s(16),
      grabCursor: true,
      pagination: {
        el: ".services__pagination",
        type: "fraction",
        formatFractionCurrent: pad,
        formatFractionTotal: pad,
      },
    });

    mobileSwiper("cases", ".cases__swiper", {
      slidesPerView: 1.1,
      spaceBetween: s(16),
      grabCursor: true,
    });
    mobileSwiper("newsOther", ".news-other__swiper", {
      slidesPerView: 1.1,
      spaceBetween: s(16),
      grabCursor: true,
    });
    mobileSwiper("history", ".history__swiper", {
      slidesPerView: 1,
      spaceBetween: s(16),
      grabCursor: true,
      autoHeight: true,
      pagination: {
        el: ".history__counter",
        type: "fraction",
      },
      navigation: {
        prevEl: ".history__arrow--prev",
        nextEl: ".history__arrow--next",
      },
    });


  };

  // ======================
  // Сетки с фильтром и «показать ещё» (кейсы, новости)
  // ======================
  const initFilterGrid = () => {
    $$("[data-filter-grid]").forEach((root) => {
      const cards = $$("[data-category]", root);
      const filters = $$("[data-filter]", root);
      const more = $("[data-more]", root);
      const step = Number(root.dataset.step) || 8;

      if (!cards.length) return;

      let visible = step;
      let category = "all";

      const render = () => {
        const matched = cards.filter((card) => category === "all" || card.dataset.category === category);

        cards.forEach((card) => card.classList.add("is-hidden"));
        matched.slice(0, visible).forEach((card) => card.classList.remove("is-hidden"));

        if (more) more.hidden = matched.length <= visible;
      };

      filters.forEach((filter) => {
        filter.addEventListener("click", () => {
          category = filter.dataset.filter || "all";
          visible = step;
          filters.forEach((f) => f.classList.toggle("is-active", f === filter));
          render();
        });
      });

      more?.addEventListener("click", () => {
        visible += step;
        render();
      });

      render();
    });
  };

  // ======================
  // Modals
  // ======================
  const initModals = ({ scrollLock, closeMobileMenu }) => {
    const wrapper = $(".modals");
    if (!wrapper) return;

    const modals = $$(".modal", wrapper);
    const getModalByType = (type) => wrapper.querySelector(`.modal[data-type="${type}"]`);

    const showWrapper = () => {
      wrapper.style.opacity = 1;
      wrapper.style.pointerEvents = "auto";
      scrollLock?.lock?.("modal");
    };

    const hideWrapper = () => {
      wrapper.style.opacity = 0;
      wrapper.style.pointerEvents = "none";
      scrollLock?.unlock?.("modal");
    };

    const fillFromCard = (modal, btn) => {
      const card = btn.closest("[data-modal-source]");
      if (!modal || !card) return;

      const modalImg = $(".modal__img img", modal);
      const cardImg = $("[data-modal-img]", card);
      if (modalImg && cardImg) {
        modalImg.src = cardImg.src;
        modalImg.alt = cardImg.alt;
      }

      const title = $(".modal__title", modal);
      if (title) title.textContent = $("[data-modal-title]", card)?.textContent.trim() ?? "";

      const text = $(".modal__text", modal);
      if (text) text.innerHTML = $("[data-modal-text]", card)?.innerHTML ?? "";
    };

    const fillTopic = (modal, btn) => {
      if (!modal) return;

      const source = btn.closest(".modal");
      const topic = source ? $(".modal__title", source)?.textContent.trim() ?? "" : "";
      const label = source?.dataset.topicLabel ?? "";

      $$("[data-modal-topic]", modal).forEach((el) => {
        if (el.tagName === "INPUT") {
          el.value = topic && label ? `${label}: ${topic}` : topic;
          return;
        }
        el.textContent = topic;
        el.hidden = !topic;
        if (label) {
          el.dataset.label = label;
        } else {
          delete el.dataset.label;
        }
      });
    };

    const openModal = (type) => {
      closeMobileMenu?.();

      modals.forEach((m) => {
        m.classList.remove("open");
        m.style.removeProperty("transform");
      });

      const modal = getModalByType(type);
      if (!modal) return;

      modal.classList.add("open");
      showWrapper();

      if (window.gsap) {
        window.gsap.fromTo(modal, { y: -100 }, { y: 0, duration: 0.5, ease: "power3.out" });
      }
    };

    const closeCurrentModal = () => {
      const current = modals.find((m) => m.classList.contains("open"));

      const finish = () => {
        if (current) current.classList.remove("open");
        hideWrapper();
      };

      if (current && window.gsap) {
        window.gsap.to(current, {
          y: -100,
          duration: 0.4,
          ease: "power3.in",
          onComplete: () => {
            current.style.removeProperty("transform");
            finish();
          },
        });
      } else {
        finish();
      }
    };

    $$(".modal-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const type = btn.dataset.type;
        if (!type) return;

        const modal = getModalByType(type);
        fillFromCard(modal, btn);
        fillTopic(modal, btn);
        openModal(type);
      });
    });

    wrapper.addEventListener("click", (e) => {
      if (
        e.target === wrapper ||
        e.target.closest(".modal__close") ||
        e.target.closest("[data-modal-close]")
      ) closeCurrentModal();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && wrapper.style.pointerEvents === "auto") closeCurrentModal();
    });

    return { open: openModal, close: closeCurrentModal };
  };

  // ======================
  // Формы
  // ======================
  const initForms = ({ modals }) => {
    $$(".form").forEach((form) => {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        // здесь будет реальная отправка, пока показываем окно «заявка отправлена»
        modals?.open?.("success");
        form.reset();
      });
    });
  };

  // ======================
  // Phone mask
  // ======================
  const initPhoneMask = () => {
    const inputs = $$('input[type="tel"]');
    if (!inputs.length) return;

    const format = (value, matrix) => {
      const prefix = matrix.replace(/\D/g, "");
      const slots = (matrix.match(/[_\d]/g) || []).length;
      const free = slots - prefix.length;
      const head = matrix.slice(0, matrix.indexOf("_"));

      let body;
      if (value.startsWith(head)) {
        body = value.slice(head.length).replace(/\D/g, "");
      } else {
        body = value.replace(/\D/g, "");
        if (body.length > free && /^[78]/.test(body)) body = body.slice(1);
      }
      body = body.slice(0, free);
      if (!body) return "";

      const digits = prefix + body;
      let res = "";
      let i = 0;
      for (const ch of matrix) {
        if (/[_\d]/.test(ch)) {
          if (i >= digits.length) break;
          res += digits[i++];
        } else {
          res += ch;
        }
      }
      return res.replace(/\D+$/, "");
    };

    inputs.forEach((input) => {
      const matrix = input.dataset.mask || "+7 (___) ___ ____";
      const prefix = matrix.replace(/\D/g, "");

      input.addEventListener("input", (e) => {
        const entered = input.value.replace(/\D/g, "");
        if (e.inputType?.startsWith("delete") && entered.length <= prefix.length) {
          input.value = "";
          return;
        }
        input.value = format(input.value, matrix);
      });
    });
  };

  // ======================
  // Загрузка файла (резюме)
  // ======================
  const initFileInputs = () => {
    $$("[data-file]").forEach((drop) => {
      const input = $('input[type="file"]', drop);
      const label = $("[data-file-name]", drop);
      if (!input || !label) return;

      const placeholder = label.textContent.trim();

      const render = () => {
        const file = input.files?.[0];
        label.textContent = file ? file.name : placeholder;
        drop.classList.toggle("is-filled", Boolean(file));
      };

      input.addEventListener("change", render);

      ["dragenter", "dragover"].forEach((type) => {
        drop.addEventListener(type, (e) => {
          e.preventDefault();
          drop.classList.add("is-drag");
        });
      });

      ["dragleave", "dragend", "drop"].forEach((type) => {
        drop.addEventListener(type, () => drop.classList.remove("is-drag"));
      });

      drop.addEventListener("drop", (e) => {
        e.preventDefault();
        const files = e.dataTransfer?.files;
        if (!files?.length) return;
        input.files = files;
        render();
      });

      drop.closest("form")?.addEventListener("reset", () => {
        setTimeout(render);
      });
    });
  };

  // ======================
  // Калькулятор стоимости
  // ======================
  const initCalc = () => {
    const root = $("[data-calc]");
    if (!root) return;

    const VAT = 0.16;
    const fields = {};
    $$("[data-calc-input]", root).forEach((el) => {
      fields[el.dataset.calcInput] = el;
    });

    const num = (el) => {
      const value = Number.parseFloat(el?.value);
      return Number.isFinite(value) && value > 0 ? value : 0;
    };
    const price = (el) => Number.parseFloat(el?.dataset.price) || 0;
    const optionOf = (select) => select?.selectedOptions?.[0];
    const checked = (el) => (el?.checked ? price(el) : 0);
    const money = (value) => `${Math.round(value).toLocaleString("ru-RU")} ₸`;
    const monthsLabel = (months) => (months === 1 ? "месяц" : months < 5 ? "месяца" : "месяцев");
    const getMonths = () => Number($(".calc__period.is-active", root)?.dataset.months) || 1;

    // ограничение значения числового поля его min/max
    const clamp = (input, value) => {
      const min = input.min === "" ? -Infinity : Number(input.min);
      const max = input.max === "" ? Infinity : Number(input.max);
      return Math.min(max, Math.max(min, value));
    };
    const normalize = (input) => {
      if (input?.type !== "number") return;
      const value = Number.parseFloat(input.value);
      input.value = clamp(input, Number.isFinite(value) ? value : Number(input.min) || 0);
    };
    const syncSteppers = () => {
      $$("[data-step]", root).forEach((btn) => {
        const input = $(".calc__input", btn.closest(".calc__stepper"));
        if (!input) return;
        const value = Number(input.value) || 0;
        btn.disabled = clamp(input, value + (Number(btn.dataset.step) || 0)) === value;
      });
    };

    const render = () => {
      const tariff = optionOf(fields.tariff)?.dataset ?? {};
      const vm = Math.max(1, num(fields.vm));
      const k = Number(optionOf(fields.dc)?.dataset.k) || 1;

      const rows = {
        vcpu: num(fields.vcpu) * (Number(tariff.cpu) || 0) * vm,
        vram: num(fields.vram) * (Number(tariff.ram) || 0) * vm,
        nvme: num(fields.nvme) * (Number(tariff.nvme) || 0) * vm,
        ssd: num(fields.ssd) * (Number(tariff.ssd) || 0) * vm,
        hdd: num(fields.hdd) * (Number(tariff.hdd) || 0) * vm,
        backup: (price(optionOf(fields.backup)) + checked(fields.geo) + checked(fields.dr)) * vm,
        s3: num(fields.s3) * price(fields.s3),
        ip: num(fields.ip) * price(fields.ip),
        firewall: price(optionOf(fields.firewall)),
        net: checked(fields.net100) + checked(fields.net1000),
      };

      Object.entries(rows).forEach(([key, value]) => {
        const cell = $(`[data-calc-row="${key}"]`, root);
        if (!cell) return;
        cell.textContent = money(value * k);
        const optional = cell.closest("[data-calc-optional]");
        if (optional) optional.hidden = value <= 0;
      });

      const months = getMonths();
      const month = Object.values(rows).reduce((sum, value) => sum + value, 0) * k;
      const total = month * months;
      // цены в тарифах указаны с учетом НДС, поэтому налог выделяется из итога
      const vat = total * VAT / (1 + VAT);

      $("[data-calc-total]", root).textContent = money(total);
      $("[data-calc-vat]", root).textContent = money(vat);
      $("[data-calc-period]", root).textContent = `${months} ${monthsLabel(months)}`;
      $("[data-calc-month]", root).textContent = money(month);

      const name = optionOf(fields.tariff)?.textContent.trim() ?? "";
      const nameEl = $("[data-tariff-name]", root);
      if (nameEl) nameEl.textContent = name;

      $$("[data-tariff-price]", root).forEach((el) => {
        el.textContent = (Number(tariff[el.dataset.tariffPrice]) || 0).toLocaleString("ru-RU");
      });

      const summary = $("[data-calc-summary]", root);
      if (summary) {
        summary.value = [
          name,
          `vCPU ${num(fields.vcpu)}`,
          `RAM ${num(fields.vram)} GB`,
          `SSD ${num(fields.ssd)} GB`,
          `HDD ${num(fields.hdd)} GB`,
          `NVMe ${num(fields.nvme)} GB`,
          `ВМ ${vm}`,
          `${months} ${monthsLabel(months)}`,
          money(total),
        ].join(", ");
      }

      syncSteppers();
    };

    root.addEventListener("input", render);
    root.addEventListener("change", (event) => {
      normalize(event.target);
      render();
    });

    $$(".calc__period", root).forEach((btn) => {
      btn.addEventListener("click", () => {
        $$(".calc__period", root).forEach((item) => item.classList.toggle("is-active", item === btn));
        render();
      });
    });

    $$("[data-step]", root).forEach((btn) => {
      btn.addEventListener("click", () => {
        const input = $(".calc__input", btn.closest(".calc__stepper"));
        if (!input) return;
        input.value = clamp(input, (Number(input.value) || 0) + (Number(btn.dataset.step) || 0));
        render();
      });
    });

    render();
  };

  // ======================
  // Тарифы
  // ======================
  const initPlans = () => {
    $$(".plans").forEach((section) => {
      const table = $(".plans__table", section);
      const tabs = $$("[data-plan-tab]", section);
      if (!table || !tabs.length) return;

      tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
          tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
          table.dataset.plans = tab.dataset.planTab;
        });
      });
    });
  };

  // ======================
  // Карта регионов: подсветка точки и плашки города
  // ======================
  const initRegionsMap = () => {
    $$(".regions__map").forEach((map) => {
      const targets = $$("[data-region]", map);
      if (!targets.length) return;

      let active = null;

      const setActive = (region) => {
        if (active === region) return;
        active = region;
        targets.forEach((el) => el.classList.toggle("is-active", Boolean(region) && el.dataset.region === region));
      };

      targets.forEach((el) => {
        const region = el.dataset.region;

        el.addEventListener("mouseenter", () => setActive(region));
        el.addEventListener("focus", () => setActive(region));
        el.addEventListener("click", (e) => {
          e.preventDefault();
          setActive(active === region ? null : region);
        });
      });

      map.addEventListener("mouseleave", () => setActive(null));
      map.addEventListener("focusout", (e) => {
        if (!map.contains(e.relatedTarget)) setActive(null);
      });
    });
  };

  // ======================
  // История: горизонтальная лента на скролле
  // ======================
  // Зазор между шапкой и заголовком секции в момент пина
  const HISTORY_TOP_GAP = 24;

  // Ручная поправка положения пина в px: минус — выше, плюс — ниже
  const HISTORY_TOP_SHIFT = -60;

  // Отступ от верха экрана до верха секции, когда она зафиксирована: ставим её
  // под шапку и центрируем в оставшемся пространстве. Нижний паддинг секции в
  // центровке не участвует — иначе блок уезжает под шапку
  const historyStartOffset = (section) => {
    const header = $(".header");
    const top = (header ? header.offsetHeight : 0) + s(HISTORY_TOP_GAP);
    const pad = parseFloat(window.getComputedStyle(section).paddingBottom) || 0;
    const content = section.offsetHeight - pad;
    const free = window.innerHeight - top;

    return Math.round((content < free ? top + (free - content) / 2 : top) + HISTORY_TOP_SHIFT);
  };

  const initHistoryScroll = () => {
    if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

    const section = $(".history");
    if (!section) return;

    const track = $(".history__swiper .swiper-wrapper", section);
    if (!track) return;

    gsap.registerPlugin(ScrollTrigger);

    gsap.matchMedia().add("(min-width: 1025px)", () => {
      const cards = $$(".swiper-slide", track);
      if (!cards.length) return;

      let distance = 0;

      // Меряем на несдвинутой ленте, иначе в расчёт попадёт текущий transform
      const measure = () => {
        gsap.set(track, { x: 0 });
        const box = track.getBoundingClientRect();
        const right = cards.reduce((max, card) => Math.max(max, card.getBoundingClientRect().right), box.right);
        distance = Math.max(0, Math.round(right - box.right));
      };

      measure();

      const st = ScrollTrigger.create({
        trigger: section,
        start: () => `top top+=${historyStartOffset(section)}`,
        end: () => `+=${distance}`,
        pin: section,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onRefreshInit: measure,
        onUpdate: (self) => gsap.set(track, { x: -distance * self.progress }),
      });

      return () => {
        st.kill();
        gsap.set(track, { clearProps: "x" });
      };
    });
  };

  // ======================
  // Reveal / intro
  // ======================
  const ANIM_CLASS = "anim";

  const ANIM = {
    duration: 0.9,
    stagger: 0.08,
    distance: 40,
    blur: 6,
    ease: "power3.out",
    start: "top 88%",
    maxDepth: 4,
  };

  const ANIM_CARDS = "[class*='__card'], [class*='__item']";

  const ANIM_ATOMIC = ".swiper, .clients__marquee, table";

  const ANIM_SKIP = ".no-anim, [data-no-anim], .preloader, .modal";

  const animContents = (el) => window.getComputedStyle(el).display === "contents";

  const animHidden = (el) => !animContents(el) && !el.getClientRects().length;

  const animCards = (root) => $$(ANIM_CARDS, root).filter((card) => {
    if (card.closest(ANIM_SKIP) || animHidden(card)) return false;
    const outer = card.parentElement && card.parentElement.closest(ANIM_CARDS);
    return !outer || !root.contains(outer);
  });

  const animWalk = (el, depth, out) => {
    if (el.closest(ANIM_SKIP)) return;
    if (animContents(el)) {
      Array.from(el.children).forEach((child) => animWalk(child, depth, out));
      return;
    }
    if (animHidden(el)) return;
    if (el.matches(ANIM_ATOMIC) || el.matches(ANIM_CARDS)) { out.push(el); return; }

    const cards = depth < ANIM.maxDepth ? animCards(el) : [];
    if (cards.length > 1) {
      Array.from(el.children).forEach((child) => animWalk(child, depth + 1, out));
      return;
    }

    out.push(el);
  };

  const animHide = (el, direction = 1) => {
    gsap.set(el, {
      opacity: 0,
      y: s(ANIM.distance) * direction,
      filter: `blur(${s(ANIM.blur)}px)`,
    });
  };

  const animPlay = (items, delay = 0) => {
    if (!items.length) return;

    gsap.to(items, {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      duration: ANIM.duration,
      delay,
      ease: ANIM.ease,
      stagger: ANIM.stagger,
      overwrite: "auto",
      clearProps: "transform,opacity,filter,willChange",
      onComplete: () => items.forEach((el) => el.classList.add("anim--done")),
    });
  };

  const initReveal = () => {
    if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);

    const main = $("main");
    const scope = main || document.body;
    const sections = $$(":scope > section", scope);
    const firstSection = sections[0] || null;

    sections.forEach((section) => {
      if (section.closest(ANIM_SKIP)) return;
      const root = section.querySelector("[class*='__container']") || section.querySelector(".container") || section;
      const blocks = [];
      animWalk(root, 0, blocks);
      blocks.forEach((el) => el.classList.add(ANIM_CLASS));
    });

    const targets = $$(`.${ANIM_CLASS}`, scope).filter((el) => {
      if (el.parentElement && el.parentElement.closest(`.${ANIM_CLASS}`)) {
        el.classList.remove(ANIM_CLASS);
        return false;
      }
      return true;
    });

    const header = $(".header");
    if (header) header.classList.add(ANIM_CLASS);

    const intro = targets.filter((el) => firstSection && firstSection.contains(el));
    const onScroll = targets.filter((el) => !intro.includes(el));

    targets.forEach((el) => animHide(el));
    if (header) animHide(header, -1);

    const startScrollReveal = () => {
      if (onScroll.length) {
        ScrollTrigger.batch(onScroll, {
          start: ANIM.start,
          once: true,
          onEnter: (batch) => animPlay(batch),
        });
      }
      ScrollTrigger.refresh();
    };

    const playIntro = () => {
      if (header) animPlay([header]);
      animPlay(intro, 0.15);
      gsap.delayedCall(0.35, startScrollReveal);
    };

    onIntroReady(playIntro);
  };

  const initPreloader = () => {
    const root = $("[data-preloader]");

    if (!root) {
      document.documentElement.classList.remove("is-loading");
      markIntroReady();
      return;
    }

    const level = $("[data-preloader-level]", root);
    const trace = $("[data-preloader-trace]", root);
    const bar = $("[data-preloader-bar]", root);

    if (trace?.getTotalLength) {
      const length = Math.round(trace.getTotalLength());
      if (length) root.style.setProperty("--trace-len", length);
    }

    const images = $$("img");
    const total = images.length;
    let loaded = 0;

    const countImage = () => { loaded += 1; };

    images.forEach((img) => {
      if (img.complete) {
        loaded += 1;
        return;
      }
      img.addEventListener("load", countImage, { once: true });
      img.addEventListener("error", countImage, { once: true });
    });

    const MIN_DURATION = 3000;
    const started = performance.now();

    let shown = 0;
    let ready = false;
    let raf = 0;

    const target = () => {
      const elapsed = performance.now() - started;
      if (ready && elapsed >= MIN_DURATION) return 100;
      const byTime = (elapsed / MIN_DURATION) * 100;
      const byAssets = total ? (loaded / total) * 100 : 100;
      return Math.min(96, byTime, byAssets);
    };

    const render = (value) => {
      const p = Math.min(100, Math.max(0, value));
      if (bar) bar.style.width = `${p}%`;
      if (level) level.setAttribute("transform", `translate(0 ${512 - 5.36 * p})`);
    };

    const finish = () => {
      cancelAnimationFrame(raf);
      render(100);
      root.classList.add("is-hidden");
      document.documentElement.classList.remove("is-loading");
      markIntroReady();
      setTimeout(() => {
        root.remove();
        refreshLayout();
      }, 600);
    };

    const tick = () => {
      const goal = target();
      shown += (goal - shown) * (goal === 100 ? 0.18 : 0.09);
      render(shown);

      if (goal === 100 && shown > 99) {
        finish();
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    const markReady = () => { ready = true; };

    if (document.readyState === "complete") markReady();
    else window.addEventListener("load", markReady, { once: true });

    setTimeout(markReady, 8000);

    render(0);
    raf = requestAnimationFrame(tick);
  };

  initPreloader();

  document.addEventListener("DOMContentLoaded", () => {
    const lenis = initLenis();
    updateMultiplier();

    const scrollLock = createScrollLock(lenis);


    initHeader();
    const mobileMenu = initBurger({ scrollLock });
    initHeaderDropdown({ scrollLock });
    initLang();
    initTabs();
    initFaq();
    initFilterGrid();
    initFooter();
    initSwipers();
    initPhoneMask();
    initFileInputs();
    initCalc();
    initPlans();
    initRegionsMap();
    const modals = initModals({ scrollLock, closeMobileMenu: mobileMenu?.close });
    initForms({ modals });
    initHistoryScroll();
    initReveal();


    refreshLayout();
    initLayoutWatcher();

    window.addEventListener("resize", debounce(() => {
      updateMultiplier();
      refreshLayout();
    }, 150));
  });
})();
