// Interactive Deals & Flavour Pull-Downs for Coldberry Ice Cream Nigeria
// Handles pull-down selectors for deal ice cream flavours, size options, and expandable related lists.

(function () {
  "use strict";

  // Canonical live prices from coldberry.ng
  const PIZZA_PRICES = {
    traditional: {
      Medium: "₦11,200",
      Large: "₦14,150",
      Champion: "₦21,200",
    },
    special: {
      Medium: "₦12,200",
      Large: "₦14,800",
      Champion: "₦22,000",
    },
    exclusive: {
      Medium: "₦13,500",
      Large: "₦15,000",
      Champion: "₦23,500",
    },
    nineoverloaded: {
      Medium: "₦15,100",
      Large: "₦16,500",
      Champion: "₦25,000",
    },
  };

  // Maps flavour names (lowercase, trimmed) to categories
  const PIZZA_CATEGORY_MAP = {
    // Classic Creamery (Traditional): Vanilla Bean, Strawberry Bliss, Belgian Chocolate Fudge, BlueMoon Berry, Caramel Popcorn
    "coldberry vanilla bean": "traditional",
    "vanilla bean": "traditional",
    "strawberry bliss swirl": "traditional",
    "strawberry bliss": "traditional",
    "belgian chocolate fudge": "traditional",
    "chocolate fudge": "traditional",
    "bluemoon berry cream": "traditional",
    "bluemoon berry": "traditional",
    "caramel popcorn crunch": "traditional",
    "caramel popcorn": "traditional",
    "pepperoni": "traditional",
    "pepperoni pizza": "traditional",
    "bbq chicken": "traditional",
    "bbq chicken pizza": "traditional",
    "chicken supreme": "traditional",
    "chicken supreme pizza": "traditional",
    "veggie supreme": "traditional",
    "veggie supreme pizza": "traditional",
    "bbq beef": "traditional",
    "bbq beef pizza": "traditional",

    // Signature Rolled & Swirl (Special): Coldberry Delight, Oreo & Strawberry Roll, Rainbow Berry Rolls, Caramel Swirl Sundae
    "coldberry delight": "special",
    "oreo & strawberry roll": "special",
    "oreo and strawberry roll": "special",
    "rainbow berry rolls": "special",
    "rainbow rolls": "special",
    "caramel swirl sundae": "special",
    "caramel swirl": "special",
    "beef suya": "special",
    "beef suya pizza": "special",
    "shawarma": "special",
    "shawarma pizza": "special",
    "chicken suya": "special",
    "chicken suya pizza": "special",
    "sweet chilli chicken": "special",
    "sweet chilli chicken pizza": "special",
    "sweet chili chicken": "special",
    "sweet chili chicken pizza": "special",

    // Supreme Indulgence (Exclusive): Chocolate Romance Supreme, Cheesecake Fantasy Crunch, Fresh Cream & Berry Classic
    "chocolate romance supreme": "exclusive",
    "chocolate romance": "exclusive",
    "cheesecake fantasy crunch": "exclusive",
    "cheesecake fantasy": "exclusive",
    "fresh cream & berry classic": "exclusive",
    "fresh cream and berry classic": "exclusive",
    "meatylover": "exclusive",
    "meatylover pizza": "exclusive",
    "sweet & hot": "exclusive",
    "sweet & hot pizza": "exclusive",
    "sweet and hot": "exclusive",
    "sweet and hot pizza": "exclusive",
    "margherita": "exclusive",
    "margherita pizza": "exclusive",

    // Nineoverloaded Tub
    "coldberry nineoverloaded tub": "nineoverloaded",
    "nineoverloaded": "nineoverloaded",
    "nineoverloaded pizza": "nineoverloaded",
    "nine overloaded": "nineoverloaded",
    "nine overloaded pizza": "nineoverloaded",
  };

  // Helper to decode HTML entities in names
  function decodeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&amp;/g, "&")
      .replace(/&#38;/g, "&")
      .trim();
  }

  // Normalize pizza size to canonical "Medium", "Large", or "Champion"
  function normalizeSize(size) {
    if (!size) return "Large";
    const s = String(size).toLowerCase().trim();
    if (s.includes("champ") || s.includes("16")) return "Champion";
    if (s.includes("med") || s.includes("10")) return "Medium";
    if (s.includes("larg") || s.includes("12")) return "Large";
    return size.charAt(0).toUpperCase() + size.slice(1);
  }

  // Lookup live price for a given pizza name and size
  function getPizzaPrice(pizzaName, sizeName) {
    if (!pizzaName) return null;
    const cleanName = decodeHtml(pizzaName).toLowerCase();
    const normalizedSize = normalizeSize(sizeName);

    // Direct category lookup
    const category = PIZZA_CATEGORY_MAP[cleanName];
    if (category && PIZZA_PRICES[category] && PIZZA_PRICES[category][normalizedSize]) {
      return PIZZA_PRICES[category][normalizedSize];
    }

    // Fuzzy / substring matching if name includes extra terms
    for (const [key, cat] of Object.entries(PIZZA_CATEGORY_MAP)) {
      if (cleanName === key || cleanName.includes(key) || key.includes(cleanName)) {
        if (PIZZA_PRICES[cat] && PIZZA_PRICES[cat][normalizedSize]) {
          return PIZZA_PRICES[cat][normalizedSize];
        }
      }
    }

    return null;
  }

  // Helper to read stored cart from RomeosCart API or localStorage (primary + legacy)
  function getCart() {
    if (typeof window !== "undefined" && window.RomeosCart && typeof window.RomeosCart.getItems === "function") {
      try {
        const items = window.RomeosCart.getItems();
        if (Array.isArray(items)) {
          const cartObj = {};
          for (const item of items) {
            const name = item && (item.name || item.title || item.item);
            const qty = item && (item.quantity || item.qty || 0);
            if (name && qty > 0) cartObj[String(name).trim()] = Number(qty);
          }
          return cartObj;
        }
      } catch (_) {}
    }

    try {
      const rawLegacy = localStorage.getItem("romeos-pizza-cart");
      if (rawLegacy) {
        const parsed = JSON.parse(rawLegacy);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed;
        }
      }

      const rawPrimary = localStorage.getItem("romeos_cart");
      if (rawPrimary) {
        const parsed = JSON.parse(rawPrimary);
        if (Array.isArray(parsed)) {
          const cartObj = {};
          for (const item of parsed) {
            const name = item && (item.name || item.title || item.item);
            const qty = item && (item.quantity || item.qty || 0);
            if (name && qty > 0) cartObj[String(name).trim()] = Number(qty);
          }
          return cartObj;
        } else if (parsed && typeof parsed === "object") {
          return parsed;
        }
      }
    } catch (_) {}

    return {};
  }

  // 1. SETUP DEALS INTERACTIVE PULL-DOWNS
  function initDeals() {
    const dealCards = document.querySelectorAll(".deal-card:not(.image-only-deal)");

    dealCards.forEach((card) => {
      const selects = card.querySelectorAll(".deal-pizza-select");
      const comboBadge = card.querySelector(".deal-combo-badge");
      const quantityControl = card.querySelector(".quantity-control");
      const countEl = card.querySelector("[data-cart-quantity]");
      const baseTitleEl = card.querySelector("h3, h2, .deal-title");
      const baseName = baseTitleEl ? decodeHtml(baseTitleEl.textContent) : "Deal";

      if (selects.length === 0) return;

      function updateDealSelection() {
        const selectedPizzas = Array.from(selects).map((s) => decodeHtml(s.value));
        const comboKey = `${baseName} (${selectedPizzas.join(" + ")})`;

        if (comboBadge) {
          comboBadge.textContent = `Selected: ${selectedPizzas.join(" + ")}`;
        }

        if (quantityControl) {
          quantityControl.dataset.cartItem = comboKey;
        }

        // Update displayed quantity for this specific selection
        const cart = getCart();
        const currentQty = cart[comboKey] || 0;
        if (countEl) {
          countEl.textContent = currentQty;
        }

        // Update buttons state
        const decBtn = card.querySelector('[data-cart-action="decrement"]');
        const incBtn = card.querySelector('[data-cart-action="increment"]');
        if (decBtn) {
          decBtn.disabled = currentQty <= 0;
          decBtn.setAttribute("aria-label", `Remove one ${comboKey}`);
        }
        if (incBtn) {
          incBtn.disabled = currentQty >= 10;
          incBtn.setAttribute("aria-label", `Add one ${comboKey}`);
        }
      }

      selects.forEach((select) => {
        select.addEventListener("change", updateDealSelection);
      });

      // Quick select buttons from related pizza accordion
      const selectBtns = card.querySelectorAll(".related-select-btn");
      selectBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const targetIndex = Number(btn.dataset.targetSelect || 0);
          const pizzaName = btn.dataset.pizza;
          if (selects[targetIndex]) {
            selects[targetIndex].value = pizzaName;
            updateDealSelection();

            // Provide visual feedback
            const originalText = btn.dataset.btnText || btn.textContent;
            btn.dataset.btnText = originalText;
            btn.textContent = "✓ Selected";
            btn.style.backgroundColor = "#2e7d32";
            setTimeout(() => {
              btn.textContent = btn.dataset.btnText || originalText || "Select";
              btn.style.backgroundColor = "";
            }, 1200);
          }
        });
      });

      // Initial sync
      updateDealSelection();
    });
  }

  // 2. SETUP PIZZA SIZE PULL-DOWNS
  function initPizzaSizes() {
    const sizeSelects = document.querySelectorAll(".pizza-size-select");

    sizeSelects.forEach((sizeSelect) => {
      if (sizeSelect.id === "half-pizza-size" || sizeSelect.closest(".half-and-half-accordion")) return;

      const card =
        sizeSelect.closest(".pizza-card, .deal-card, [data-pizza-card], article, .card") ||
        sizeSelect.parentElement;
      if (!card) return;

      const priceEl = card.querySelector(".price, .pizza-price, .deal-price");
      const quantityControl = card.querySelector(".quantity-control");
      const countEl = card.querySelector("[data-cart-quantity]");
      const titleEl = card.querySelector("h3, h2, .pizza-name, .deal-title");

      const initialCartItem = quantityControl ? quantityControl.dataset.cartItem || "" : "";
      const baseFromCart = initialCartItem ? initialCartItem.replace(/\s*\([^)]*\)$/, "").trim() : "";
      const baseName = decodeHtml(
        sizeSelect.dataset.baseName ||
        (titleEl ? titleEl.textContent.trim() : "") ||
        baseFromCart
      );

      if (!baseName) return;

      function updatePizzaSize() {
        const selectedOption = sizeSelect.options[sizeSelect.selectedIndex];
        if (!selectedOption) return;

        const rawSize = selectedOption.value || selectedOption.textContent;
        const sizeName = normalizeSize(rawSize);

        // Get exact live price from table or fallback to dataset.price
        const livePrice = getPizzaPrice(baseName, sizeName) || selectedOption.dataset.price;

        if (priceEl && livePrice) {
          priceEl.textContent = livePrice;
        }

        // Keep option dataset.price updated if we resolved a live price
        if (livePrice && !selectedOption.dataset.price) {
          selectedOption.dataset.price = livePrice;
        }

        const itemKey = `${baseName} (${sizeName})`;

        if (quantityControl) {
          quantityControl.dataset.cartItem = itemKey;
        }

        // Update displayed quantity for this specific size
        const cart = getCart();
        const currentQty = cart[itemKey] || 0;
        if (countEl) {
          countEl.textContent = currentQty;
        }

        // Update button states and accessibility labels
        const decBtn = card.querySelector('[data-cart-action="decrement"]');
        const incBtn = card.querySelector('[data-cart-action="increment"]');
        if (decBtn) {
          decBtn.disabled = currentQty <= 0;
          decBtn.setAttribute("aria-label", `Remove one ${itemKey}`);
        }
        if (incBtn) {
          incBtn.disabled = currentQty >= 10;
          incBtn.setAttribute("aria-label", `Add one ${itemKey}`);
        }
      }

      sizeSelect.addEventListener("change", updatePizzaSize);

      // Initial sync
      updatePizzaSize();
    });
  }

  // 3. SETUP HALF & HALF PIZZA BUILDER ACCORDION
  function initHalfAndHalf() {
    const accordion = document.querySelector(".half-and-half-accordion");
    if (!accordion) return;

    const sizeSelect = document.getElementById("half-pizza-size");
    const side1Select = document.getElementById("half-pizza-side1");
    const side2Select = document.getElementById("half-pizza-side2");
    const basePriceEl = document.getElementById("half-base-price");
    const surchargeEl = document.getElementById("half-surcharge-price");
    const totalPriceEl = document.getElementById("half-total-price");
    const quantityControl = accordion.querySelector(".quantity-control");
    const countEl = accordion.querySelector("[data-cart-quantity]");
    const decBtn = accordion.querySelector('[data-cart-action="decrement"]');
    const incBtn = accordion.querySelector('[data-cart-action="increment"]');
    const previewLeft = document.getElementById("half-preview-left");
    const previewRight = document.getElementById("half-preview-right");
    const labelLeft = document.getElementById("half-label-left");
    const labelRight = document.getElementById("half-label-right");

    const PIZZA_IMAGE_MAP = {
      "vanilla": "images/coldberry-scoop.jpg",
      "strawberry": "images/coldberry-scoop.jpg",
      "chocolate": "images/coldberry-scoop.jpg",
      "bluemoon": "images/coldberry-scoop.jpg",
      "popcorn": "images/coldberry-scoop.jpg",
      "delight": "images/coldberry-hero.jpg",
      "oreo": "images/coldberry-hero.jpg",
      "rainbow": "images/coldberry-hero.jpg",
      "caramel": "images/coldberry-hero.jpg",
      "cheesecake": "images/coldberry-scoop.jpg",
      "fresh cream": "images/coldberry-scoop.jpg",
      "pepperoni": "images/coldberry-scoop.jpg",
      "bbq chicken": "images/coldberry-scoop.jpg",
      "chicken supreme": "images/coldberry-scoop.jpg",
      "veggie supreme": "images/coldberry-scoop.jpg",
      "bbq beef": "images/coldberry-scoop.jpg",
      "beef suya": "images/coldberry-hero.jpg",
      "shawarma": "images/coldberry-hero.jpg",
      "chicken suya": "images/coldberry-hero.jpg",
      "sweet chilli": "images/coldberry-hero.jpg",
      "meatylover": "images/coldberry-scoop.jpg",
      "nineoverloaded": "images/coldberry-hero.jpg",
      "sweet & hot": "images/coldberry-scoop.jpg",
      "margherita": "images/coldberry-scoop.jpg"
    };

    function getPizzaImage(name) {
      const lower = (name || "").toLowerCase();
      for (const [key, url] of Object.entries(PIZZA_IMAGE_MAP)) {
        if (lower.includes(key)) return url;
      }
      return PIZZA_IMAGE_MAP.pepperoni;
    }

    if (!sizeSelect || !side1Select || !side2Select) return;

    function getNumericPrice(pizzaName, sizeName) {
      const priceStr = getPizzaPrice(pizzaName, sizeName);
      if (!priceStr) return 0;
      return Number(priceStr.replace(/[^0-9]/g, "")) || 0;
    }

    function formatNaira(amount) {
      return `₦${Math.round(Number(amount) || 0).toLocaleString("en-NG")}`;
    }

    function updateHalfAndHalf() {
      const rawSize = sizeSelect.value || "Large";
      const sizeName = normalizeSize(rawSize);
      const side1Name = decodeHtml(side1Select.value);
      const side2Name = decodeHtml(side2Select.value);

      const price1 = getNumericPrice(side1Name, sizeName);
      const price2 = getNumericPrice(side2Name, sizeName);
      const maxPrice = Math.max(price1, price2);
      const surcharge = Math.round(maxPrice * 0.05);
      const totalPrice = Math.round(maxPrice * 1.05);

      if (basePriceEl) {
        basePriceEl.textContent = formatNaira(maxPrice);
      }
      if (surchargeEl) {
        surchargeEl.textContent = `+${formatNaira(surcharge)}`;
      }
      if (totalPriceEl) {
        totalPriceEl.textContent = formatNaira(totalPrice);
      }

      if (previewLeft) {
        previewLeft.style.backgroundImage = `url("${getPizzaImage(side1Name)}")`;
      }
      if (previewRight) {
        previewRight.style.backgroundImage = `url("${getPizzaImage(side2Name)}")`;
      }
      if (labelLeft) {
        labelLeft.textContent = side1Name;
      }
      if (labelRight) {
        labelRight.textContent = side2Name;
      }

      const itemKey = `Half & Half Pizza (${side1Name} + ${side2Name}, ${sizeName})`;
      if (quantityControl) {
        quantityControl.dataset.cartItem = itemKey;
      }

      const cart = getCart();
      const currentQty = cart[itemKey] || 0;

      if (countEl) {
        countEl.textContent = currentQty;
      }
      if (decBtn) {
        decBtn.disabled = currentQty <= 0;
        decBtn.setAttribute("aria-label", `Remove one ${itemKey}`);
      }
      if (incBtn) {
        incBtn.disabled = currentQty >= 10;
        incBtn.setAttribute("aria-label", `Add one ${itemKey}`);
      }
    }

    sizeSelect.addEventListener("change", updateHalfAndHalf);
    side1Select.addEventListener("change", updateHalfAndHalf);
    side2Select.addEventListener("change", updateHalfAndHalf);

    if (quantityControl) {
      quantityControl.addEventListener("click", (event) => {
        const button = event.target.closest("[data-cart-action]");
        if (!button) return;
        setTimeout(() => {
          if (!event.__cartHandled) {
            const itemKey = quantityControl.dataset.cartItem;
            if (!itemKey) return;
            const cart = getCart();
            const currentQty = cart[itemKey] || 0;
            let nextQty = currentQty;
            if (button.dataset.cartAction === "increment" && currentQty < 10) {
              nextQty = currentQty + 1;
            } else if (button.dataset.cartAction === "decrement" && currentQty > 0) {
              nextQty = currentQty - 1;
            }
            if (nextQty !== currentQty) {
              if (nextQty === 0) {
                delete cart[itemKey];
              } else {
                cart[itemKey] = nextQty;
              }
              try {
                localStorage.setItem("romeos-pizza-cart", JSON.stringify(cart));
                const primaryArray = Object.entries(cart).map(([name, quantity]) => ({ name, quantity }));
                localStorage.setItem("romeos_cart", JSON.stringify(primaryArray));
              } catch (_) {}
              document.dispatchEvent(new CustomEvent("cart:change"));
            }
          }
        }, 0);
      });
    }

    // Initial calculation
    updateHalfAndHalf();
  }

  // 4. LISTEN FOR GLOBAL CART CHANGES TO KEEP DISPLAYS IN SYNC
  if (typeof document !== "undefined") {
    document.addEventListener("cart:change", () => {
      const cart = getCart();
      document.querySelectorAll("[data-cart-item]").forEach((control) => {
        const itemKey = control.dataset.cartItem;
        const count = control.querySelector("[data-cart-quantity]");
        const decBtn = control.querySelector('[data-cart-action="decrement"]');
        const incBtn = control.querySelector('[data-cart-action="increment"]');
        const qty = cart[itemKey] || 0;
        if (count) count.textContent = qty;
        if (decBtn) decBtn.disabled = qty <= 0;
        if (incBtn) incBtn.disabled = qty >= 10;
      });
    });
  }

  // Multi-tab storage sync
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key === "romeos-pizza-cart" || event.key === "romeos_cart") {
        if (typeof document !== "undefined") {
          document.dispatchEvent(new CustomEvent("cart:change"));
        }
      }
    });

    // Expose for testing and external access
    window.RomeosDeals = {
      initDeals,
      initPizzaSizes,
      initHalfAndHalf,
      getPizzaPrice,
      normalizeSize,
      PIZZA_PRICES,
    };
  }

  // Run on DOM ready
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        initDeals();
        initPizzaSizes();
        initHalfAndHalf();
      });
    } else {
      initDeals();
      initPizzaSizes();
      initHalfAndHalf();
    }
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      initDeals,
      initPizzaSizes,
      initHalfAndHalf,
      getPizzaPrice,
      normalizeSize,
      PIZZA_PRICES,
    };
  }
})();
