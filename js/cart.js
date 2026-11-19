(function () {
  "use strict";

  const CART_STORAGE_KEY_LEGACY = "romeos-pizza-cart";
  const CART_STORAGE_KEY_PRIMARY = "romeos_cart";
  const MAX_ITEM_QUANTITY = 10;
  let cart = readCart();

  function readCart() {
    try {
      const rawLegacy = localStorage.getItem(CART_STORAGE_KEY_LEGACY);
      const rawPrimary = localStorage.getItem(CART_STORAGE_KEY_PRIMARY);
      let stored = null;

      if (rawLegacy) {
        try {
          const parsedLegacy = JSON.parse(rawLegacy);
          if (parsedLegacy && typeof parsedLegacy === "object" && !Array.isArray(parsedLegacy)) {
            stored = parsedLegacy;
          }
        } catch (_) {}
      }

      if (!stored && rawPrimary) {
        try {
          const parsedPrimary = JSON.parse(rawPrimary);
          if (Array.isArray(parsedPrimary)) {
            stored = {};
            for (const item of parsedPrimary) {
              const name = item && (item.name || item.title || item.item);
              const qty = item && (item.quantity || item.qty || 1);
              if (name && qty > 0) {
                stored[String(name).trim()] = Number(qty);
              }
            }
          } else if (parsedPrimary && typeof parsedPrimary === "object") {
            stored = parsedPrimary;
          }
        } catch (_) {}
      }

      if (!stored || typeof stored !== "object") {
        return {};
      }

      const normalizedCart = Object.fromEntries(
        Object.entries(stored)
          .filter(([name, quantity]) => typeof name === "string" && name.trim() && Number.isInteger(quantity) && quantity > 0)
          .map(([name, quantity]) => [name.trim(), Math.min(quantity, MAX_ITEM_QUANTITY)])
      );

      return normalizedCart;
    } catch {
      return {};
    }
  }

  function getCartCount() {
    return Object.values(cart).reduce((total, quantity) => total + quantity, 0);
  }

  function createQuantityControl(name, quantity) {
    const control = document.createElement("div");
    control.className = "quantity-control";
    control.dataset.cartItem = name;

    const decrement = document.createElement("button");
    decrement.type = "button";
    decrement.dataset.cartAction = "decrement";
    decrement.setAttribute("aria-label", `Remove one ${name}`);
    decrement.textContent = "−";
    decrement.disabled = quantity <= 0;

    const count = document.createElement("span");
    count.dataset.cartQuantity = "";
    count.setAttribute("aria-live", "polite");
    count.textContent = quantity;

    const increment = document.createElement("button");
    increment.type = "button";
    increment.dataset.cartAction = "increment";
    increment.setAttribute("aria-label", `Add one ${name}`);
    increment.textContent = "+";
    increment.disabled = quantity >= MAX_ITEM_QUANTITY;

    control.append(decrement, count, increment);
    return control;
  }

  function renderCart() {
    cart = readCart();
    const itemCount = getCartCount();
    const countElement = document.getElementById("cart-count");
    if (countElement) {
      countElement.textContent = itemCount;
      countElement.classList.toggle("has-items", itemCount > 0);
    }
    document.querySelectorAll("[data-nav-cart-count]").forEach((badge) => {
      badge.textContent = itemCount;
      badge.classList.toggle("has-items", itemCount > 0);
    });
    const navCartLink = document.getElementById("nav-cart-link");
    if (navCartLink) {
      navCartLink.classList.toggle("has-items", itemCount > 0);
      navCartLink.setAttribute(
        "aria-label",
        `Shopping cart (${itemCount} ${itemCount === 1 ? "item" : "items"})`
      );
    }
    const countLabel = document.getElementById("cart-count-label");
    if (countLabel) {
      countLabel.textContent = `${itemCount === 1 ? "item" : "items"} in your cart`;
    }

    document.querySelectorAll("[data-cart-item]").forEach((control) => {
      const name = control.dataset.cartItem;
      const quantity = cart[name] || 0;
      const count = control.querySelector("[data-cart-quantity]");
      const decrement = control.querySelector('[data-cart-action="decrement"]');
      const increment = control.querySelector('[data-cart-action="increment"]');

      if (count) count.textContent = quantity;
      if (decrement) decrement.disabled = quantity <= 0;
      if (increment) increment.disabled = quantity >= MAX_ITEM_QUANTITY;

      // Update surrounding addon card visual state if present
      const card = control.closest(".checkout-addon-card");
      if (card) {
        card.classList.toggle("is-in-cart", quantity > 0);
      }
    });

    const isOrderFormPresent = !!document.getElementById("order-form");
    const list = document.getElementById("order-cart-items");
    const emptyMessage = document.getElementById("cart-empty");

    // Only render #order-cart-items if order.js is not loaded to prevent duplication
    if (list && !isOrderFormPresent) {
      list.replaceChildren();
      for (const [name, quantity] of Object.entries(cart)) {
        const item = document.createElement("li");
        item.className = "cart-item";
        const label = document.createElement("span");
        label.className = "cart-item-name";
        label.textContent = name;
        item.append(label, createQuantityControl(name, quantity));
        list.append(item);
      }
    }
    if (emptyMessage && !isOrderFormPresent) {
      emptyMessage.hidden = itemCount > 0;
    }
  }

  let cartChannel = null;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      cartChannel = new BroadcastChannel("romeos_cart_channel");
      cartChannel.onmessage = () => {
        renderCart();
      };
    }
  } catch (_) {}

  function saveCart() {
    try {
      localStorage.setItem(CART_STORAGE_KEY_LEGACY, JSON.stringify(cart));
      const itemsArray = Object.entries(cart).map(([name, quantity]) => ({ name, quantity }));
      localStorage.setItem(CART_STORAGE_KEY_PRIMARY, JSON.stringify(itemsArray));
    } catch {
      // The cart remains usable for this page even if browser storage is unavailable.
    }
    renderCart();
    if (cartChannel) {
      try {
        cartChannel.postMessage({ type: "cart:change" });
      } catch (_) {}
    }
    document.dispatchEvent(new CustomEvent("cart:change", { detail: { count: getCartCount() } }));
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cart-action]");
    const control = button?.closest("[data-cart-item]");
    if (!control) return;

    if (event.__cartHandled) return;
    event.__cartHandled = true;

    const name = control.dataset.cartItem;
    if (!name) return;

    cart = readCart();
    const quantity = cart[name] || 0;
    if (button.dataset.cartAction === "increment" && quantity < MAX_ITEM_QUANTITY) {
      cart[name] = quantity + 1;
    } else if (button.dataset.cartAction === "decrement" && quantity > 0) {
      if (quantity === 1) {
        delete cart[name];
      } else {
        cart[name] = quantity - 1;
      }
    }
    saveCart();
  });

  const requestedItem = new URLSearchParams(window.location.search).get("item");
  if (requestedItem?.trim()) {
    cart = readCart();
    const itemName = requestedItem.trim();
    cart[itemName] = Math.min((cart[itemName] || 0) + 1, MAX_ITEM_QUANTITY);
    const url = new URL(window.location.href);
    url.searchParams.delete("item");
    window.history.replaceState({}, "", url);
    saveCart();
  } else {
    renderCart();
  }

  window.addEventListener("storage", (event) => {
    if (event.key === CART_STORAGE_KEY_LEGACY || event.key === CART_STORAGE_KEY_PRIMARY) {
      renderCart();
    }
  });

  document.addEventListener("cart:change", () => {
    renderCart();
  });

  window.RomeosCart = {
    getItems: () => {
      cart = readCart();
      return Object.entries(cart).map(([name, quantity]) => ({ name, quantity }));
    },
  };
})();
